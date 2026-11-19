import { describe, expect, it } from "vitest";
import {
  isPharmacyType,
  isPrescriberType,
  medicationChangeId,
  medicationContentZSchema,
  timelineEntryContentZSchema,
} from "../schema";
import {
  DEV_FAMILY_DOSES,
  DEV_FAMILY_MEDICATIONS,
  SECOND_GROUP_MEDICATIONS,
  SEED_GROUPS,
  seedRows,
} from "./medications";
import { seedRows as providerRows } from "./providers";

// Seeds write straight to the tables, skipping the services' validation, so
// check them against the same rules the API enforces.

// 12:00 PM in Los Angeles: this morning's slots have passed, this evening's haven't.
const NOON = Date.UTC(2026, 10, 17, 20, 0);
const content = ({ id: _id, groupId: _g, recipientId: _r, createdAt: _c, updatedAt: _u, ...rest }: Row) => {
  const { createdByEmail: _cb, updatedByEmail: _ub, ...fields } = rest;
  return fields;
};
type Row = ReturnType<typeof seedRows>[number]["rows"][number];

describe("medication seeds", () => {
  it("are valid medications, stored exactly as the schema would", () => {
    for (const { rows } of seedRows(NOON)) {
      for (const row of rows) {
        expect(medicationContentZSchema.parse(content(row))).toEqual(content(row));
      }
    }
  });

  it("give Grandma Pat four current medications, a completed course and a discontinued one", () => {
    const [devFamily, secondGroup] = seedRows(NOON);
    const byStatus = (status: string) => devFamily?.rows.filter((r) => r.status === status) ?? [];
    expect(byStatus("current")).toHaveLength(4);
    expect(byStatus("completed")).toHaveLength(1);
    expect(byStatus("discontinued")).toHaveLength(1);
    expect(byStatus("discontinued")[0]).toMatchObject({ stopReason: "sideEffects" });

    const current = byStatus("current");
    expect(current.some((m) => m.schedule.type === "scheduled" && m.schedule.slots.length === 2)).toBe(true);
    expect(current.filter((m) => m.schedule.type === "asNeeded")).toHaveLength(1);
    expect(current.some((m) => m.refillsLeft !== null && m.lastFilledOn && m.quantity)).toBe(true);
    expect(DEV_FAMILY_MEDICATIONS.some((m) => m.notes)).toBe(true);

    expect(SECOND_GROUP_MEDICATIONS).toHaveLength(1);
    expect(secondGroup?.rows).toHaveLength(1);
    expect(secondGroup?.rows[0]?.groupId).toBe(SEED_GROUPS[1]?.groupId);
  });

  it("stopped the completed course within the last 90 days", () => {
    const [devFamily] = seedRows(NOON);
    const completed = devFamily?.rows.find((r) => r.status === "completed");
    const days = (NOON - Date.parse(`${completed?.stoppedOn}T12:00:00Z`)) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(0);
    expect(days).toBeLessThan(90);
  });

  it("name a clinician or practice as prescriber and a pharmacy as pharmacy, in the same group", () => {
    const providers = providerRows();
    seedRows(NOON).forEach(({ rows }, group) => {
      const typeOf = new Map(providers[group]?.rows.map((p) => [p.id, p.type]));
      for (const row of rows) {
        if (row.prescriberId) expect(isPrescriberType(typeOf.get(row.prescriberId) ?? "")).toBe(true);
        if (row.pharmacyId) expect(isPharmacyType(typeOf.get(row.pharmacyId) ?? "")).toBe(true);
      }
    });
    expect(seedRows(NOON)[0]?.rows.some((r) => r.prescriberId && r.pharmacyId)).toBe(true);
  });

  it("write valid dose and change entries for medications in their own group", () => {
    for (const { rows, changes, doses } of seedRows(NOON)) {
      const ids = new Set(rows.map((r) => r.id));
      for (const { id: _id, groupId, recipientId: _r, author: _a, ...entry } of [...changes, ...doses]) {
        const parsed = timelineEntryContentZSchema.safeParse(entry);
        expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
        expect(ids.has(entry.details.medicationId)).toBe(true);
        expect(groupId).toBe(rows[0]?.groupId);
      }
    }
  });

  it("give every medication its 'started' entry, and each save the entry the service would write", () => {
    const [devFamily, secondGroup] = seedRows(NOON);
    const changesOf = (key: string) => {
      const id = devFamily?.rows[DEV_FAMILY_MEDICATIONS.findIndex((m) => m.key === key)]?.id;
      return (devFamily?.changes ?? []).filter((c) => c.details.medicationId === id).map((c) => c.details);
    };
    for (const group of [devFamily, secondGroup]) {
      for (const row of group?.rows ?? []) {
        const started = group?.changes.filter(
          (c) => c.details.medicationId === row.id && "change" in c.details && c.details.change === "started",
        );
        expect(started).toHaveLength(1);
        expect(started?.[0]?.occurredAt).toBe(row.createdAt);
      }
      // The id is the one the service derives from the medication and the time of the save.
      for (const change of group?.changes ?? []) {
        expect(change.id).toBe(medicationChangeId(change.details.medicationId, change.occurredAt));
      }
    }

    expect(changesOf("lisinopril")).toMatchObject([
      { change: "started", after: { strength: "5 mg" } },
      { change: "changed", fields: ["strength"], before: { strength: "5 mg" }, after: { strength: "10 mg" } },
    ]);
    expect(changesOf("acetaminophen")[1]).toMatchObject({ change: "changed", fields: ["schedule"] });
    expect(changesOf("amoxicillin")[1]).toMatchObject({ change: "stopped", stopStatus: "completed" });
    expect(changesOf("oxybutynin")[1]).toMatchObject({
      change: "stopped",
      stopStatus: "discontinued",
      stopReason: "sideEffects",
    });
    // A refill is saved without an entry.
    expect(changesOf("latanoprost")).toHaveLength(1);
  });

  it("log about a week of doses: mostly given, a few skipped, one refused", () => {
    const [devFamily] = seedRows(NOON);
    const doses = devFamily?.doses ?? [];
    const statusOf = (status: string) =>
      doses.filter((d) => "status" in d.details && d.details.status === status);
    expect(doses.length).toBeGreaterThan(25);
    expect(statusOf("skipped").length).toBeGreaterThanOrEqual(3);
    expect(statusOf("refused")).toHaveLength(1);
    expect(statusOf("given").length).toBeGreaterThan(20);
    expect(statusOf("skipped").every((d) => "note" in d.details && d.details.note)).toBe(true);

    const oldest = Math.min(...doses.map((d) => Date.parse(d.occurredAt)));
    expect((NOON - oldest) / (24 * 60 * 60 * 1000)).toBeLessThan(8);
    // As-needed doses answer no slot.
    expect(doses.some((d) => !("scheduledFor" in d.details))).toBe(true);
  });

  it("never log a dose ahead of time, and keep each dose's id when some are left out", () => {
    const early = Date.UTC(2026, 10, 17, 14, 0); // 6:00 AM in Los Angeles
    const [atNoon] = seedRows(NOON);
    const [atDawn] = seedRows(early);
    expect(atDawn?.doses.every((d) => Date.parse(d.occurredAt) <= early)).toBe(true);
    expect(atDawn?.doses.length).toBeLessThan(atNoon?.doses.length ?? 0);
    // This evening's slots are never logged by the seed: they're left for someone to log.
    expect(atNoon?.doses).toHaveLength(DEV_FAMILY_DOSES.length);
    expect(DEV_FAMILY_DOSES.some((d) => d.daysAgo === 0 && (d.scheduledFor ?? "") >= "18:00")).toBe(false);

    const idsAtNoon = new Set(atNoon?.doses.map((d) => d.id));
    expect(atDawn?.doses.every((d) => idsAtNoon.has(d.id))).toBe(true);
  });

  it("give every row its own id", () => {
    const groups = seedRows(NOON);
    const ids = groups.flatMap(({ rows, changes, doses }) =>
      [...rows, ...changes, ...doses].map((r) => r.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});
