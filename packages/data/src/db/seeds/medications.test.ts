import { describe, expect, it } from "vitest";
import {
  isPharmacyType,
  isPrescriberType,
  medicationChangeId,
  medicationContentZSchema,
  timelineEntryContentZSchema,
} from "../schema";
import { DEV_FAMILY_DOSES, seedRows } from "./medications";
import { seedPassRows } from "./medicationPasses";
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

  it("give every medication its 'started' entry, and each save the id the service would derive", () => {
    const [devFamily, secondGroup] = seedRows(NOON);
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

  it("put scheduled medications in their group's passes, with their doses naming them", () => {
    const [devFamily] = seedRows(NOON);
    const passes = new Map(
      seedPassRows()
        .filter((p) => p.groupId === devFamily?.rows[0]?.groupId)
        .map((p) => [p.id, p.time]),
    );
    for (const row of devFamily?.rows ?? []) {
      if (row.schedule.type !== "scheduled") continue;
      for (const slot of row.schedule.slots) if ("passId" in slot) expect(passes.has(slot.passId)).toBe(true);
    }
    // A dose in a pass names it, at the pass's time.
    const doses = devFamily?.doses ?? [];
    for (const dose of doses) {
      if (dose.kind !== "dose" || !("scheduledFor" in dose.details)) continue;
      const passId = "passId" in dose.details ? dose.details.passId : undefined;
      if (passId) expect(passes.get(passId)).toBe(dose.details.scheduledFor);
    }
  });

  it("give every row its own id", () => {
    const groups = seedRows(NOON);
    const ids = groups.flatMap(({ rows, changes, doses }) =>
      [...rows, ...changes, ...doses].map((r) => r.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});
