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
  extra: { deletedAt?: string; createdAt?: string } = {},
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
          code: code!.code,
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
        { mail: async () => ({ id: crypto.randomUUID() }) },
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

  it("doesn't touch the entries it reads", async () => {
    const g = await bareGroup();
    const [entry] = await symptomEntry(g, { name: "Sore wrist" });
    ok(await symptomTypeService.backfill());
    const [after] = await getDb()
      .select()
      .from(timelineEntrySchema)
      .where(eq(timelineEntrySchema.id, entry!.id));
    expect(after).toEqual(entry);
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
