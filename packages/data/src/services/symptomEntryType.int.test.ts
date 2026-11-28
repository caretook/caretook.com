import { eq, sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import type { Tx } from "../db";

import { createWorld, ok } from "../../test/fixtures";
import { SYSTEM_USER } from "../constants";
import { getDb, withTransaction } from "../db";
import {
  careGroupSchema,
  careRecipientSchema,
  symptomTypeId,
  symptomTypeRow,
  symptomTypeSchema,
  timelineEntrySchema,
} from "../db/schema";
import { isError } from "../errors";
import { assistantActionService, symptomTypeService, timelineEntryService } from ".";

// Every symptom entry points at its type (symptom-catalog slice 2): the
// entry service derives `symptom_type_id` from `details.name` on every
// write, adding the name to the catalog when it's new; the backfill fills
// older entries' pointers without touching their wording or `updated_at`;
// the composite foreign key keeps a pointer inside the entry's group.
// Fictional groups and names throughout.

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");
const audits = { createdBy: SYSTEM_USER.id, updatedBy: SYSTEM_USER.id };
const at = "2026-11-20T15:00:00.000Z";
const timeZone = "America/Chicago";

const symptom = (groupId: string, name: string, severity = 3) => ({
  groupId,
  kind: "symptom" as const,
  occurredAt: at,
  timeZone,
  details: { name, severity },
});

const rowOf = async (id: string) => {
  const [row] = await getDb().select().from(timelineEntrySchema).where(eq(timelineEntrySchema.id, id));
  return row!;
};

const typeKeys = async (groupId: string) =>
  (
    await getDb()
      .select({ key: symptomTypeSchema.nameKey })
      .from(symptomTypeSchema)
      .where(eq(symptomTypeSchema.groupId, groupId))
  ).map((r) => r.key);

/**
 * "Nauseous" deleted into "Nausea" (symptom-catalog-3): its tombstone written
 * straight to the table, as `replace` leaves it.
 */
const tombstone = async (groupId: string, name = "Nauseous", into = "Nausea") => {
  await getDb()
    .insert(symptomTypeSchema)
    .values({
      ...symptomTypeRow(groupId, name),
      archivedAt: "2026-11-21T10:00:00.000Z",
      replacedById: symptomTypeId(groupId, into),
      ...audits,
    });
};

describe("writing a symptom", () => {
  it("points a new symptom at its type, and adds an unknown name to the catalog", async () => {
    const { u, groupId } = await createWorld({ members: ["caretaker"] });
    const known = ok(await timelineEntryService.create(u.caretaker.ctx, symptom(groupId, " nAUSea ")));
    expect(known?.symptomTypeId).toBe(symptomTypeId(groupId, "Nausea"));
    // The wording stays as the zod schema trims it; the catalog keeps its own spelling.
    expect(known?.details).toMatchObject({ name: "nAUSea" });

    const fresh = ok(await timelineEntryService.create(u.caretaker.ctx, symptom(groupId, "Sore heel")));
    expect(fresh?.symptomTypeId).toBe(symptomTypeId(groupId, "sore heel"));
    expect(await typeKeys(groupId)).toContain("sore heel");
  });

  it("lets an Easy helper log an unknown name, and rename their own entry to another", async () => {
    const { u, groupId } = await createWorld({ members: ["easy_helper"] });
    const entry = ok(
      await timelineEntryService.create(u.easy_helper.ctx, symptom(groupId, "Tingly fingers")),
    );
    expect(entry?.symptomTypeId).toBe(symptomTypeId(groupId, "tingly fingers"));
    const renamed = ok(
      await timelineEntryService.update(u.easy_helper.ctx, entry!.id, {
        details: { name: "Cold fingers", severity: 2 },
      }),
    );
    expect(renamed?.symptomTypeId).toBe(symptomTypeId(groupId, "cold fingers"));
    expect(await typeKeys(groupId)).toEqual(expect.arrayContaining(["tingly fingers", "cold fingers"]));
  });

  it("moves the pointer on a rename, and keeps it on an edit that leaves the name", async () => {
    const { u, groupId } = await createWorld({ members: ["caretaker"] });
    const entry = ok(await timelineEntryService.create(u.caretaker.ctx, symptom(groupId, "Headache")));
    const renamed = ok(
      await timelineEntryService.update(u.caretaker.ctx, entry!.id, {
        details: { name: "Pain", severity: 4 },
      }),
    );
    expect(renamed?.symptomTypeId).toBe(symptomTypeId(groupId, "Pain"));
    const recased = ok(
      await timelineEntryService.update(u.caretaker.ctx, entry!.id, {
        details: { name: "PAIN", severity: 5 },
      }),
    );
    expect(recased?.symptomTypeId).toBe(symptomTypeId(groupId, "Pain"));
    expect(recased?.details).toMatchObject({ name: "PAIN" });
  });

  it("puts a missing pointer right on any edit", async () => {
    const { u, groupId } = await createWorld({ members: ["caretaker"] });
    const entry = ok(await timelineEntryService.create(u.caretaker.ctx, symptom(groupId, "Fever")));
    await getDb()
      .update(timelineEntrySchema)
      .set({ symptomTypeId: null })
      .where(eq(timelineEntrySchema.id, entry!.id));
    const edited = ok(
      await timelineEntryService.update(u.caretaker.ctx, entry!.id, { title: "After lunch" }),
    );
    expect(edited?.symptomTypeId).toBe(symptomTypeId(groupId, "Fever"));
  });

  it("refuses a viewer's symptom without adding its name", async () => {
    const { u, groupId } = await createWorld({ members: ["viewer"] });
    expect(codeOf(await timelineEntryService.create(u.viewer.ctx, symptom(groupId, "Viewer itch")))).toBe(
      "permissions:unauthorized",
    );
    expect(await typeKeys(groupId)).not.toContain("viewer itch");
  });

  it("never gives another kind a pointer", async () => {
    const { u, groupId } = await createWorld({ members: [] });
    const vital = ok(
      await timelineEntryService.create(u.owner.ctx, {
        groupId,
        kind: "vital",
        occurredAt: at,
        timeZone,
        details: { readings: [{ type: "heartRate", value: 70 }] },
      }),
    );
    const note = ok(
      await timelineEntryService.create(u.owner.ctx, { groupId, kind: "note", occurredAt: at, timeZone }),
    );
    const event = ok(
      await timelineEntryService.create(u.owner.ctx, {
        groupId,
        kind: "event",
        title: "Clinic visit",
        occurredAt: at,
        timeZone,
      }),
    );
    for (const entry of [vital, note, event]) expect(entry?.symptomTypeId, entry?.kind).toBeNull();
    const edited = ok(await timelineEntryService.update(u.owner.ctx, note!.id, { title: "Morning" }));
    expect(edited?.symptomTypeId).toBeNull();
  });
});

describe("the pointer's group", () => {
  it("refuses a pointer at another group's type", async () => {
    const mine = await createWorld({ members: [] });
    const theirs = await createWorld({ members: [] });
    const entry = ok(await timelineEntryService.create(mine.u.owner.ctx, symptom(mine.groupId, "Cough")));
    const res = await getDb()
      .update(timelineEntrySchema)
      .set({ symptomTypeId: symptomTypeId(theirs.groupId, "Cough") })
      .where(eq(timelineEntrySchema.id, entry!.id))
      .then(
        () => "ok",
        (e: unknown) => String((e as { cause?: { constraint?: string } }).cause?.constraint ?? e),
      );
    expect(res).toBe("timeline_entry_symptom_type_fk");
  });
});

describe("the backfill's pointers", () => {
  /** A group and its entries written straight to the tables, as before the catalog: no types, no pointers. */
  const oldGroup = async () => {
    const db = getDb();
    const [group] = await db
      .insert(careGroupSchema)
      .values({ name: "Pointer Family", ...audits })
      .returning();
    const [recipient] = await db
      .insert(careRecipientSchema)
      .values({ groupId: group!.id, name: "Rae Example", timeZone, ...audits })
      .returning();
    const entry = async (details: unknown, extra: { deletedAt?: string; kind?: "symptom" | "note" } = {}) => {
      const [row] = await db
        .insert(timelineEntrySchema)
        .values({
          groupId: group!.id,
          recipientId: recipient!.id,
          kind: "symptom",
          occurredAt: at,
          timeZone,
          details: details as never,
          // An older edit by someone else, which the backfill must not look like.
          createdBy: SYSTEM_USER.id,
          updatedBy: "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c00a1",
          updatedAt: "2026-11-02T08:30:00.000Z",
          ...extra,
        })
        .returning();
      return row!;
    };
    return { groupId: group!.id, entry };
  };

  it("fills live entries' pointers, joining case variants, with wording and updated_at as they were", async () => {
    const g = await oldGroup();
    const lower = await g.entry({ name: "knee pain", severity: 3 });
    const upper = await g.entry({ name: "Knee Pain", severity: 5 });
    const other = await g.entry({ name: "knee ache" });

    const summary = ok(await symptomTypeService.backfill());
    expect(summary.pointers).toBeGreaterThanOrEqual(3);

    const knee = symptomTypeId(g.groupId, "knee pain");
    for (const [before, pointer] of [
      [lower, knee],
      [upper, knee],
      [other, symptomTypeId(g.groupId, "knee ache")],
    ] as const) {
      const after = await rowOf(before.id);
      expect(after).toEqual({ ...before, symptomTypeId: pointer });
    }
    expect((await typeKeys(g.groupId)).filter((k) => k === "knee pain")).toHaveLength(1);

    // A rerun changes nothing.
    const again = ok(await symptomTypeService.backfill());
    expect(again).toMatchObject({ defaults: 0, history: 0, pointers: 0 });
    expect((await rowOf(lower.id)).updatedAt).toBe(lower.updatedAt);
  });

  it("points a deleted name's entry at its replacement, wording as it was", async () => {
    const g = await oldGroup();
    ok(await symptomTypeService.backfill());
    await tombstone(g.groupId);
    const old = await g.entry({ name: "nauseous", severity: 4 });
    ok(await symptomTypeService.backfill());
    expect(await rowOf(old.id)).toEqual({ ...old, symptomTypeId: symptomTypeId(g.groupId, "Nausea") });
  });

  it("leaves a soft-deleted entry, an unreadable name and other kinds without a pointer", async () => {
    const g = await oldGroup();
    const deleted = await g.entry({ name: "Ghost ache" }, { deletedAt: "2026-11-21T10:00:00.000Z" });
    const blank = await g.entry({ name: "   " });
    const note = await g.entry(null, { kind: "note" });
    ok(await symptomTypeService.backfill());
    for (const row of [deleted, blank, note]) expect((await rowOf(row.id)).symptomTypeId).toBeNull();
  });
});

describe("writing a deleted symptom's name", () => {
  it("stores the replacement's id and name on a create, in any case, adding nothing", async () => {
    const { u, groupId } = await createWorld({ members: ["caretaker"] });
    await tombstone(groupId);
    const before = await typeKeys(groupId);
    for (const name of ["Nauseous", " nAUSEOUS "]) {
      const entry = ok(await timelineEntryService.create(u.caretaker.ctx, symptom(groupId, name)));
      expect(entry?.symptomTypeId, name).toBe(symptomTypeId(groupId, "Nausea"));
      expect(entry?.details, name).toMatchObject({ name: "Nausea", severity: 3 });
    }
    expect((await typeKeys(groupId)).sort()).toEqual(before.sort());
  });

  it("stores the replacement's id and name on a rename, in any case", async () => {
    const { u, groupId } = await createWorld({ members: ["caretaker"] });
    await tombstone(groupId);
    const entry = ok(await timelineEntryService.create(u.caretaker.ctx, symptom(groupId, "Fever")));
    const renamed = ok(
      await timelineEntryService.update(u.caretaker.ctx, entry!.id, {
        details: { name: "NAUSEOUS", severity: 6 },
      }),
    );
    expect(renamed?.symptomTypeId).toBe(symptomTypeId(groupId, "Nausea"));
    expect(renamed?.details).toMatchObject({ name: "Nausea", severity: 6 });
  });

  it("lands a connector's log of the deleted name on the replacement", async () => {
    const { u, groupId } = await createWorld({ members: [] });
    await tombstone(groupId);
    const { byAction } = ok(
      await assistantActionService.run(
        u.owner.ctx,
        groupId,
        [
          {
            type: "logSymptom",
            name: "nauseous",
            severity: 2,
            occurredAt: new Date(Date.now() - 60_000).toISOString(),
          },
        ],
        { via: "Test Claude" },
      ),
    );
    const [[entryId]] = byAction as [[string]];
    const entry = ok(await timelineEntryService.getById(u.owner.ctx, entryId));
    expect(entry?.symptomTypeId).toBe(symptomTypeId(groupId, "Nausea"));
    expect(entry?.details).toMatchObject({ name: "Nausea" });
    expect(entry?.via).toBe("Test Claude");
  });

  it("answers ensure with the replacement", async () => {
    const { u, groupId } = await createWorld({ members: [] });
    await tombstone(groupId);
    const row = ok(await symptomTypeService.ensure(u.owner.ctx, groupId, "Nauseous"));
    expect(row).toMatchObject({ id: symptomTypeId(groupId, "Nausea"), name: "Nausea", replacedById: null });
  });
});

describe("a symptom write racing a replace (B-992)", () => {
  /** Sessions in this test database waiting on a lock (an advisory lock, or a row another transaction holds). */
  const lockWaiters = async () => {
    const res = await getDb().execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`,
    );
    return res.rows[0]?.n ?? 0;
  };

  /**
   * The interleaving: `replace` runs in a transaction held open; `write`
   * starts then, so its reads see the catalog and entries from before the
   * replace (it hasn't committed); once `write` waits on a lock in this
   * database, the replace commits and the write finishes after it.
   */
  const racingReplace = async <T>(replace: (tx: Tx) => Promise<unknown>, write: () => Promise<T>) => {
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    let ran = () => {};
    const replaced = new Promise<void>((resolve) => (ran = resolve));
    const committed = withTransaction(async (tx) => {
      const res = await replace(tx);
      ran();
      if (!isError(res)) await held;
      return res;
    });
    try {
      await replaced;
      const written = write();
      await vi.waitFor(async () => expect(await lockWaiters()).toBeGreaterThan(0), {
        timeout: 10_000,
        interval: 10,
      });
      release();
      return { replaced: await committed, written: await written };
    } finally {
      release();
    }
  };

  it("lands an edit read before a replace and committed after it on the replacement", async () => {
    const { u, groupId } = await createWorld({ members: ["caretaker"] });
    const entry = ok(await timelineEntryService.create(u.caretaker.ctx, symptom(groupId, "Nauseous")))!;
    const nauseous = symptomTypeId(groupId, "Nauseous");
    const nausea = symptomTypeId(groupId, "Nausea");
    expect(entry.symptomTypeId).toBe(nauseous);

    const { replaced, written } = await racingReplace(
      (tx) =>
        symptomTypeService.replace({ ...u.owner.ctx, tx }, { groupId, id: nauseous, replacementId: nausea }),
      () =>
        timelineEntryService.update(u.caretaker.ctx, entry.id, {
          details: { name: "Nauseous", severity: 5 },
        }),
    );
    expect(ok(replaced)).toEqual({ moved: 1 });
    ok(written);
    const after = await rowOf(entry.id);
    expect(after.symptomTypeId).toBe(nausea);
    expect(after.details).toMatchObject({ name: "Nausea", severity: 5 });
  });

  it("lands a create naming an older tombstone on the replacement of the row a replace retires", async () => {
    const { u, groupId } = await createWorld({ members: ["caretaker"] });
    // Queasy (A) was deleted into Nauseous (B); B is now deleted into Nausea (C).
    ok(await symptomTypeService.ensure(u.owner.ctx, groupId, "Nauseous"));
    await tombstone(groupId, "Queasy", "Nauseous");
    const nausea = symptomTypeId(groupId, "Nausea");

    const { replaced, written } = await racingReplace(
      (tx) =>
        symptomTypeService.replace(
          { ...u.owner.ctx, tx },
          { groupId, id: symptomTypeId(groupId, "Nauseous"), replacementId: nausea },
        ),
      () => timelineEntryService.create(u.caretaker.ctx, symptom(groupId, "Queasy")),
    );
    ok(replaced);
    const created = ok(written)!;
    const after = await rowOf(created.id);
    expect(after.symptomTypeId).toBe(nausea);
    expect(after.details).toMatchObject({ name: "Nausea", severity: 3 });
  });
});
