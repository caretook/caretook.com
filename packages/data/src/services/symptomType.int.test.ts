import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createUser, createWorld, ok } from "../../test/fixtures";
import { SYSTEM_USER } from "../constants";
import { getDb, withTransaction } from "../db";
import {
  careGroupSchema,
  careRecipientSchema,
  DEFAULT_SYMPTOMS,
  symptomKey,
  symptomTypeId,
  symptomTypeRow,
  symptomTypeSchema,
  timelineEntrySchema,
} from "../db/schema";
import { isError } from "../errors";
import { accessCodeService, staffGroupService, symptomTypeService } from ".";

// The symptom catalog (symptom-catalog slice 1): every way of making a group
// gives it the defaults, every member reads it and nobody else does, loggers
// add to it idempotently, and the backfill fills in groups made before it.
// Fictional groups and names throughout.

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");
const audits = { createdBy: SYSTEM_USER.id, updatedBy: SYSTEM_USER.id };
const sortedDefaults = () => DEFAULT_SYMPTOMS.map(symptomKey).sort();

const catalogOf = async (groupId: string) =>
  getDb()
    .select()
    .from(symptomTypeSchema)
    .where(eq(symptomTypeSchema.groupId, groupId))
    .orderBy(symptomTypeSchema.nameKey);

const keysOf = async (groupId: string) => (await catalogOf(groupId)).map((r) => r.nameKey);

/** A group and recipient written straight to the tables, as seeds and pre-catalog groups were: no catalog. */
const bareGroup = async (name = "Pre-catalog Family") => {
  const db = getDb();
  const [group] = await db
    .insert(careGroupSchema)
    .values({ name, ...audits })
    .returning();
  const [recipient] = await db
    .insert(careRecipientSchema)
    .values({ groupId: group!.id, name: "Lee Example", timeZone: "America/Chicago", ...audits })
    .returning();
  return { groupId: group!.id, recipientId: recipient!.id };
};

const symptomEntry = (
  g: { groupId: string; recipientId: string },
  details: unknown,
  extra: { deletedAt?: string; createdAt?: string; symptomTypeId?: string } = {},
) =>
  getDb()
    .insert(timelineEntrySchema)
    .values({
      groupId: g.groupId,
      recipientId: g.recipientId,
      kind: "symptom",
      occurredAt: "2026-11-20T15:00:00.000Z",
      timeZone: "America/Chicago",
      details: details as never,
      ...extra,
      ...audits,
    })
    .returning();

describe("a new group's catalog", () => {
  it("has all the defaults when a member makes it", async () => {
    const { groupId } = await createWorld({ members: [] });
    expect(await keysOf(groupId)).toEqual(sortedDefaults());
    const nausea = (await catalogOf(groupId)).find((r) => r.name === "Nausea");
    expect(nausea?.id).toBe(symptomTypeId(groupId, "nausea"));
  });

  it("has all the defaults when an access code makes it", async () => {
    const staff = await createUser("sym-staff", "admin");
    const code = ok(await accessCodeService.create(staff.ctx, { label: "Symptom test", expiresInDays: 7 }));
    const owner = await createUser("sym-code-owner");
    const redeemed = ok(
      await withTransaction((tx) =>
        accessCodeService.redeem(tx, {
          code: code.code,
          userId: owner.user.id,
          group: { recipientName: "Ada Example", timeZone: "America/Denver" },
        }),
      ),
    );
    expect(await keysOf(redeemed.groupId)).toEqual(sortedDefaults());
  });

  it("has all the defaults when staff make it", async () => {
    const staff = await createUser("sym-staff-group", "admin");
    const made = ok(
      await staffGroupService.createWithOwnerInvite(
        staff.ctx,
        {
          groupName: "Staff-made family",
          recipientName: "Bo Example",
          ownerEmail: `sym-owner-${crypto.randomUUID().slice(0, 8)}@example.com`,
          attested: true,
        },
        { mail: () => Promise.resolve({ id: crypto.randomUUID() }) },
      ),
    );
    expect(await keysOf(made.groupId)).toEqual(sortedDefaults());
  });
});

describe("reading the catalog", () => {
  it("lets every group role read it, and a non-member read nothing", async () => {
    const { u, groupId } = await createWorld({
      members: ["admin", "caretaker", "viewer", "easy_helper", "easy_viewer"],
      extras: ["outsider", "staff"],
    });
    for (const role of ["owner", "admin", "caretaker", "viewer", "easy_helper", "easy_viewer"] as const) {
      const listed = ok(await symptomTypeService.list(u[role].ctx, { groupId }));
      expect(
        listed.data.map((r) => r.nameKey),
        role,
      ).toEqual(sortedDefaults());
    }
    for (const who of ["outsider", "staff"] as const) {
      const listed = ok(await symptomTypeService.list(u[who].ctx, { groupId }));
      expect(listed.data, who).toEqual([]);
      expect(await symptomTypeService.getById(u[who].ctx, symptomTypeId(groupId, "Pain")), who).toBeNull();
    }
  });
});

describe("ensure", () => {
  it("returns the existing row in any case or spacing, and adds a new name once", async () => {
    const { u, groupId } = await createWorld({ members: ["caretaker"] });
    const nausea = ok(await symptomTypeService.ensure(u.caretaker.ctx, groupId, "  nAUSea "));
    expect(nausea).toMatchObject({ id: symptomTypeId(groupId, "Nausea"), name: "Nausea" });

    const added = ok(await symptomTypeService.ensure(u.caretaker.ctx, groupId, " Knee   pain "));
    expect(added).toMatchObject({
      id: symptomTypeId(groupId, "knee pain"),
      name: "Knee pain",
      nameKey: "knee pain",
      createdBy: u.caretaker.user.id,
    });
    const again = ok(await symptomTypeService.ensure(u.caretaker.ctx, groupId, "KNEE PAIN"));
    expect(again?.id).toBe(added?.id);
    expect(again?.name).toBe("Knee pain");
    expect((await catalogOf(groupId)).filter((r) => r.nameKey === "knee pain")).toHaveLength(1);
  });

  it("lets two transactions add the same new name at once, leaving one row", async () => {
    const { u, groupId } = await createWorld({ members: ["caretaker"] });
    const results = await Promise.all([
      symptomTypeService.ensure(u.owner.ctx, groupId, "Hiccups"),
      symptomTypeService.ensure(u.caretaker.ctx, groupId, "hiccups"),
    ]);
    expect(results.map(codeOf)).toEqual(["ok", "ok"]);
    expect((await catalogOf(groupId)).filter((r) => r.nameKey === "hiccups")).toHaveLength(1);
  });

  it("lets loggers add a name, and refuses viewers, Easy viewers and non-members", async () => {
    const { u, groupId } = await createWorld({
      members: ["admin", "caretaker", "viewer", "easy_helper", "easy_viewer"],
      extras: ["outsider"],
    });
    for (const role of ["owner", "admin", "caretaker", "easy_helper"] as const)
      expect(codeOf(await symptomTypeService.ensure(u[role].ctx, groupId, `Sore ${role}`)), role).toBe("ok");
    for (const role of ["viewer", "easy_viewer", "outsider"] as const)
      expect(codeOf(await symptomTypeService.ensure(u[role].ctx, groupId, `Sore ${role}`)), role).toBe(
        "permissions:unauthorized",
      );
    expect(await keysOf(groupId)).not.toContain("sore viewer");
  });

  it("refuses an empty or too-long name", async () => {
    const { u, groupId } = await createWorld({ members: [] });
    expect(codeOf(await symptomTypeService.ensure(u.owner.ctx, groupId, "   "))).toBe(
      "symptomTypeService:invalid",
    );
    expect(codeOf(await symptomTypeService.ensure(u.owner.ctx, groupId, "x".repeat(121)))).toBe(
      "symptomTypeService:invalid",
    );
  });
});

describe("backfill", () => {
  it("gives an older group the defaults and one type per distinct live name; a rerun changes nothing", async () => {
    const g = await bareGroup();
    await symptomEntry(g, { name: "knee pain", severity: 3 }, { createdAt: "2026-11-01T10:00:00.000Z" });
    await symptomEntry(g, { name: "Knee  Pain" }, { createdAt: "2026-11-02T10:00:00.000Z" });
    await symptomEntry(g, { name: "knee ache" });
    await symptomEntry(g, { name: "NAUSEA" });

    ok(await symptomTypeService.backfill());
    const rows = await catalogOf(g.groupId);
    expect(rows.map((r) => r.nameKey).sort()).toEqual([...sortedDefaults(), "knee ache", "knee pain"].sort());
    // The first spelling, the derived id, written by the system.
    expect(rows.find((r) => r.nameKey === "knee pain")).toMatchObject({
      id: symptomTypeId(g.groupId, "knee pain"),
      name: "knee pain",
      createdBy: SYSTEM_USER.id,
    });
    // A default keeps its own spelling.
    expect(rows.find((r) => r.nameKey === "nausea")?.name).toBe("Nausea");

    const before = await catalogOf(g.groupId);
    const second = ok(await symptomTypeService.backfill());
    expect(second).toMatchObject({ defaults: 0, history: 0 });
    expect(await catalogOf(g.groupId)).toEqual(before);
  });

  it("adds no type for a name found only on a soft-deleted entry", async () => {
    const g = await bareGroup();
    await symptomEntry(g, { name: "Ghost itch" }, { deletedAt: "2026-11-21T10:00:00.000Z" });
    ok(await symptomTypeService.backfill());
    expect(await keysOf(g.groupId)).toEqual(sortedDefaults());
  });

  it("leaves out an entry whose name can't be read, and says which", async () => {
    const g = await bareGroup();
    const [blank] = await symptomEntry(g, { name: "   " });
    const [missing] = await symptomEntry(g, { severity: 2 });
    const summary = ok(await symptomTypeService.backfill());
    expect(summary.unreadable).toEqual(expect.arrayContaining([blank!.id, missing!.id]));
    expect(await keysOf(g.groupId)).toEqual(sortedDefaults());
  });

  it("changes nothing on the entries it reads but their pointer (slice 2)", async () => {
    const g = await bareGroup();
    const [entry] = await symptomEntry(g, { name: "Sore wrist" });
    ok(await symptomTypeService.backfill());
    const [after] = await getDb()
      .select()
      .from(timelineEntrySchema)
      .where(eq(timelineEntrySchema.id, entry!.id));
    expect(after).toEqual({ ...entry, symptomTypeId: symptomTypeId(g.groupId, "sore wrist") });
  });
});

describe("archive and unarchive (symptom-catalog-2 slice 1)", () => {
  const rowOf = async (id: string) =>
    (await getDb().select().from(symptomTypeSchema).where(eq(symptomTypeSchema.id, id)))[0]!;

  it("let a caretaker and an admin archive and bring back a row, naming them in updated_by", async () => {
    const { u, groupId } = await createWorld({ members: ["admin", "caretaker"] });
    for (const role of ["caretaker", "admin"] as const) {
      const id = symptomTypeId(groupId, role === "admin" ? "Nausea" : "Pain");
      const archived = ok(await symptomTypeService.archive(u[role].ctx, { groupId, id }));
      expect(archived?.archivedAt, role).toEqual(expect.any(String));
      expect(await rowOf(id), role).toMatchObject({ updatedBy: u[role].user.id });

      const back = ok(await symptomTypeService.unarchive(u[role].ctx, { groupId, id }));
      expect(back?.archivedAt, role).toBeNull();
      expect(await rowOf(id), role).toMatchObject({ archivedAt: null, updatedBy: u[role].user.id });
    }
  });

  it("refuses an Easy helper, a viewer, an Easy viewer and a non-member", async () => {
    const { u, groupId } = await createWorld({
      members: ["viewer", "easy_helper", "easy_viewer"],
      extras: ["outsider"],
    });
    const id = symptomTypeId(groupId, "Pain");
    ok(await symptomTypeService.archive(u.owner.ctx, { groupId, id }));
    const before = await rowOf(id);
    for (const role of ["easy_helper", "viewer", "easy_viewer", "outsider"] as const) {
      expect(codeOf(await symptomTypeService.unarchive(u[role].ctx, { groupId, id })), role).toBe(
        "permissions:unauthorized",
      );
      expect(codeOf(await symptomTypeService.archive(u[role].ctx, { groupId, id })), role).toBe(
        "permissions:unauthorized",
      );
    }
    expect(await rowOf(id)).toEqual(before);
  });

  it("changes nothing on a repeat", async () => {
    const { u, groupId } = await createWorld({ members: ["caretaker"] });
    const id = symptomTypeId(groupId, "Cough");
    ok(await symptomTypeService.archive(u.owner.ctx, { groupId, id }));
    const archived = await rowOf(id);
    ok(await symptomTypeService.archive(u.caretaker.ctx, { groupId, id }));
    expect(await rowOf(id)).toEqual(archived);

    ok(await symptomTypeService.unarchive(u.owner.ctx, { groupId, id }));
    const active = await rowOf(id);
    const again = ok(await symptomTypeService.unarchive(u.caretaker.ctx, { groupId, id }));
    expect(again).toEqual(active);
    expect(await rowOf(id)).toEqual(active);
  });

  it("refuses a tombstone and another group's row", async () => {
    const { u, groupId } = await createWorld({ members: [] });
    const other = await createWorld({ members: [] });
    const [tombstone] = await getDb()
      .insert(symptomTypeSchema)
      .values({
        ...symptomTypeRow(groupId, "Tummy ache"),
        replacedById: symptomTypeId(groupId, "Nausea"),
        ...audits,
      })
      .returning();
    for (const call of [symptomTypeService.archive, symptomTypeService.unarchive])
      expect(codeOf(await call(u.owner.ctx, { groupId, id: tombstone!.id }))).toBe(
        "symptomTypeService:merged",
      );
    expect(await rowOf(tombstone!.id)).toEqual(tombstone);

    // Another group's row, under this group's id or its own (where this owner isn't a member).
    const theirs = symptomTypeId(other.groupId, "Pain");
    expect(codeOf(await symptomTypeService.archive(u.owner.ctx, { groupId, id: theirs }))).toBe(
      "symptomTypeService:notFound",
    );
    expect(
      codeOf(await symptomTypeService.archive(u.owner.ctx, { groupId: other.groupId, id: theirs })),
    ).toBe("permissions:unauthorized");
    expect((await rowOf(theirs)).archivedAt).toBeNull();
  });

  it("refuses a tombstone pointing at itself or at another group's row", async () => {
    const { groupId } = await createWorld({ members: [] });
    const other = await createWorld({ members: [] });
    const self = symptomTypeRow(groupId, "Loop");
    await expect(
      getDb()
        .insert(symptomTypeSchema)
        .values({ ...self, replacedById: self.id, ...audits }),
    ).rejects.toThrow();
    await expect(
      getDb()
        .insert(symptomTypeSchema)
        .values({
          ...symptomTypeRow(groupId, "Stray"),
          replacedById: symptomTypeId(other.groupId, "Pain"),
          ...audits,
        }),
    ).rejects.toThrow();
  });

  it("isn't undone by the backfill, for a default or a logged name", async () => {
    const { u, groupId, recipient } = await createWorld({ members: [] });
    await symptomEntry({ groupId, recipientId: recipient.id }, { name: "nausea" });
    const id = symptomTypeId(groupId, "Nausea");
    ok(await symptomTypeService.archive(u.owner.ctx, { groupId, id }));
    const archived = await rowOf(id);
    ok(await symptomTypeService.backfill());
    expect(await rowOf(id)).toEqual(archived);
    expect((await catalogOf(groupId)).filter((r) => r.nameKey === "nausea")).toHaveLength(1);
  });
});

describe("replace (symptom-catalog-3 slice 2)", () => {
  const typeOf = async (id: string) =>
    (await getDb().select().from(symptomTypeSchema).where(eq(symptomTypeSchema.id, id)))[0]!;
  const entryOf = async (id: string) =>
    (await getDb().select().from(timelineEntrySchema).where(eq(timelineEntrySchema.id, id)))[0]!;
  const entriesOf = async (groupId: string) =>
    getDb()
      .select()
      .from(timelineEntrySchema)
      .where(eq(timelineEntrySchema.groupId, groupId))
      .orderBy(timelineEntrySchema.id);

  /** A group with "Nauseous" (two entries, one soft-deleted) and an older tombstone "Queasy" pointing at it. */
  const nauseousWorld = async () => {
    const world = await createWorld({ members: ["admin", "caretaker"] });
    const { u, groupId, recipient } = world;
    const g = { groupId, recipientId: recipient.id };
    const nauseous = ok(await symptomTypeService.ensure(u.owner.ctx, groupId, "Nauseous"))!;
    const [queasy] = await getDb()
      .insert(symptomTypeSchema)
      .values({ ...symptomTypeRow(groupId, "Queasy"), replacedById: nauseous.id, ...audits })
      .returning();
    const [live] = await symptomEntry(g, { name: "nauseous", severity: 4 }, { symptomTypeId: nauseous.id });
    const [deleted] = await symptomEntry(
      g,
      { name: "Nauseous", severity: 2 },
      { symptomTypeId: nauseous.id, deletedAt: "2026-11-21T10:00:00.000Z" },
    );
    const [other] = await symptomEntry(
      g,
      { name: "Pain", severity: 5 },
      { symptomTypeId: symptomTypeId(groupId, "Pain") },
    );
    return { ...world, nauseous, queasy: queasy!, live: live!, deleted: deleted!, other: other! };
  };

  it("lets an owner move live and deleted entries, repoint an older tombstone, and returns the count", async () => {
    const { u, groupId, nauseous, queasy, live, deleted, other } = await nauseousWorld();
    const nausea = symptomTypeId(groupId, "Nausea");
    expect(
      ok(await symptomTypeService.replace(u.owner.ctx, { groupId, id: nauseous.id, replacementId: nausea })),
    ).toEqual({ moved: 2 });

    // A deleted entry keeps its scrubbed details (`SCRUB_SPECS`): only its pointer moves.
    expect(deleted.details).toBeNull();
    for (const before of [live, deleted]) {
      const after = await entryOf(before.id);
      expect(after).toMatchObject({
        symptomTypeId: nausea,
        details: before.deletedAt ? null : { ...(before.details as object), name: "Nausea" },
        updatedBy: u.owner.user.id,
        deletedAt: before.deletedAt,
      });
      expect(new Date(after.updatedAt).getTime()).toBeGreaterThan(new Date(before.updatedAt).getTime());
    }
    expect(await entryOf(other.id)).toEqual(other);
    expect(await typeOf(queasy.id)).toMatchObject({ replacedById: nausea, updatedBy: u.owner.user.id });
    const tombstone = await typeOf(nauseous.id);
    expect(tombstone).toMatchObject({ replacedById: nausea, updatedBy: u.owner.user.id });
    expect(tombstone.archivedAt).toEqual(expect.any(String));
    expect((await typeOf(nausea)).replacedById).toBeNull();
  });

  it("refuses an admin and a caretaker, changing nothing", async () => {
    const { u, groupId, nauseous } = await nauseousWorld();
    const before = { types: await catalogOf(groupId), entries: await entriesOf(groupId) };
    for (const role of ["admin", "caretaker"] as const)
      expect(
        codeOf(
          await symptomTypeService.replace(u[role].ctx, {
            groupId,
            id: nauseous.id,
            replacementId: symptomTypeId(groupId, "Nausea"),
          }),
        ),
        role,
      ).toBe("permissions:unauthorized");
    expect({ types: await catalogOf(groupId), entries: await entriesOf(groupId) }).toEqual(before);
  });

  it("refuses the same id, another group's replacement and a tombstone replacement", async () => {
    const { u, groupId, nauseous, queasy } = await nauseousWorld();
    const other = await createWorld({ members: [] });
    const before = { types: await catalogOf(groupId), entries: await entriesOf(groupId) };
    const tried = (replacementId: string) =>
      symptomTypeService.replace(u.owner.ctx, { groupId, id: nauseous.id, replacementId });
    expect(codeOf(await tried(nauseous.id.toUpperCase()))).toBe("symptomTypeService:sameSymptom");
    expect(codeOf(await tried(symptomTypeId(other.groupId, "Nausea")))).toBe(
      "symptomTypeService:replacementNotFound",
    );
    expect(codeOf(await tried(queasy.id))).toBe("symptomTypeService:replacementMerged");
    expect({ types: await catalogOf(groupId), entries: await entriesOf(groupId) }).toEqual(before);
  });

  it("refuses a rerun on a tombstone and changes nothing; an archived row keeps its archived_at", async () => {
    const { u, groupId, nauseous } = await nauseousWorld();
    ok(await symptomTypeService.archive(u.owner.ctx, { groupId, id: nauseous.id }));
    const archivedAt = (await typeOf(nauseous.id)).archivedAt;
    const input = { groupId, id: nauseous.id, replacementId: symptomTypeId(groupId, "Nausea") };
    ok(await symptomTypeService.replace(u.owner.ctx, input));
    expect((await typeOf(nauseous.id)).archivedAt).toBe(archivedAt);

    const before = { types: await catalogOf(groupId), entries: await entriesOf(groupId) };
    expect(codeOf(await symptomTypeService.replace(u.owner.ctx, input))).toBe("symptomTypeService:merged");
    expect(
      codeOf(
        await symptomTypeService.replace(u.owner.ctx, {
          ...input,
          replacementId: symptomTypeId(groupId, "Fever"),
        }),
      ),
    ).toBe("symptomTypeService:merged");
    expect({ types: await catalogOf(groupId), entries: await entriesOf(groupId) }).toEqual(before);
  });
});

describe("a group's deletion", () => {
  it("removes its catalog", async () => {
    const g = await bareGroup();
    ok(await symptomTypeService.backfill());
    expect((await keysOf(g.groupId)).length).toBe(DEFAULT_SYMPTOMS.length);
    await getDb().delete(timelineEntrySchema).where(eq(timelineEntrySchema.groupId, g.groupId));
    await getDb().delete(careRecipientSchema).where(eq(careRecipientSchema.groupId, g.groupId));
    await getDb().delete(careGroupSchema).where(eq(careGroupSchema.id, g.groupId));
    expect(await keysOf(g.groupId)).toEqual([]);
  });
});
