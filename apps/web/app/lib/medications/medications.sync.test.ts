import type { MedicationRow } from "./medications.sync";
import type { EntryRow } from "../timeline/timeline.sync";

import { describe, expect, it } from "vitest";
import {
  dayBounds,
  dayInZone,
  groupDosesQuery,
  medicationEntriesQuery,
  medicationNamesQuery,
  medicationsQuery,
  toMedication,
  toMedicationEntries,
  toMedicationEntry,
  toMedications,
} from "./medications.sync";
import { entriesQuery } from "../timeline/timeline.sync";

const MEDICATION_ID = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9a1001";

const row = (overrides: Partial<MedicationRow> = {}): MedicationRow => ({
  id: MEDICATION_ID,
  group_id: "g1",
  recipient_id: "r1",
  name: "Lisinopril",
  strength: "10 mg",
  form: "tablet",
  dose: "1 tablet",
  directions: null,
  reason: "Blood pressure",
  schedule: JSON.stringify({ type: "scheduled", times: ["08:00", "20:00"] }),
  status: "current",
  started_on: "2026-10-01",
  stopped_on: null,
  stop_reason: null,
  stop_note: null,
  prescriber_id: null,
  pharmacy_id: null,
  last_filled_on: null,
  quantity: null,
  refills_left: 2,
  rx_number: null,
  deleted_at: null,
  created_at: "2026-11-17T21:45:25.229000Z",
  updated_at: "2026-11-17T21:45:25.229000Z",
  created_by: "u1",
  updated_by: "u1",
  ...overrides,
});

const entryRow = (overrides: Partial<EntryRow> = {}): EntryRow => ({
  id: "e1",
  group_id: "g1",
  recipient_id: "r1",
  kind: "dose",
  occurred_at: "2026-11-17T16:05:00.000000Z",
  time_zone: "America/Los_Angeles",
  title: null,
  body: null,
  details: JSON.stringify({ medicationId: MEDICATION_ID, status: "given", amount: "1 tablet" }),
  deleted_at: null,
  created_at: "2026-11-17T16:05:10.000000Z",
  updated_at: "2026-11-17T16:05:10.000000Z",
  created_by: "u1",
  updated_by: "u1",
  ...overrides,
});

describe("toMedication", () => {
  it("maps a synced row: the schedule from JSON, dates as they are, ISO timestamps", () => {
    expect(toMedication(row())).toMatchObject({
      id: MEDICATION_ID,
      groupId: "g1",
      recipientId: "r1",
      name: "Lisinopril",
      form: "tablet",
      // Stored in the old shape (an older build's), read as time slots.
      schedule: { type: "scheduled", slots: [{ time: "08:00" }, { time: "20:00" }] },
      status: "current",
      startedOn: "2026-10-01",
      refillsLeft: 2,
      deletedAt: null,
      updatedAt: "2026-11-17T21:45:25.229Z",
    });
  });

  it("skips a row it can't show: no name, no group, or a schedule from a newer app", () => {
    expect(toMedication(row({ name: null }))).toBeNull();
    expect(toMedication(row({ group_id: null }))).toBeNull();
    expect(toMedication(row({ schedule: JSON.stringify({ type: "everyOtherDay" }) }))).toBeNull();
    expect(toMedication(row({ schedule: "{" }))).toBeNull();
    expect(toMedications([row(), row({ id: "m2", schedule: null })]).map((m) => m.id)).toEqual([
      MEDICATION_ID,
    ]);
  });

  it("reads an unknown form or stop reason as none, and an unknown status as current", () => {
    expect(toMedication(row({ form: "lozenge", stop_reason: "recalled", status: "paused" }))).toMatchObject({
      form: null,
      stopReason: null,
      status: "current",
    });
  });
});

describe("toMedicationEntry", () => {
  it("maps a dose and a medication change", () => {
    expect(toMedicationEntry(entryRow())).toEqual({
      id: "e1",
      groupId: "g1",
      kind: "dose",
      occurredAt: "2026-11-17T16:05:00.000Z",
      timeZone: "America/Los_Angeles",
      createdAt: "2026-11-17T16:05:10.000Z",
      createdBy: "u1",
      details: { medicationId: MEDICATION_ID, status: "given", amount: "1 tablet" },
    });
    const change = { medicationId: MEDICATION_ID, change: "changed", fields: ["dose"] };
    expect(
      toMedicationEntry(entryRow({ kind: "medicationChange", details: JSON.stringify(change) })),
    ).toMatchObject({
      kind: "medicationChange",
      details: change,
    });
  });

  it("skips other kinds and malformed details", () => {
    expect(toMedicationEntry(entryRow({ kind: "note", details: null }))).toBeNull();
    expect(toMedicationEntry(entryRow({ details: JSON.stringify({ status: "given" }) }))).toBeNull();
    expect(toMedicationEntry(entryRow({ kind: "medicationChange" }))).toBeNull();
    expect(toMedicationEntries([entryRow(), entryRow({ id: "e2", details: "{" })]).map((e) => e.id)).toEqual([
      "e1",
    ]);
  });
});

describe("medication queries", () => {
  it("lists current medications first, then by name, without deleted ones", () => {
    const { sql, params } = medicationsQuery("g1");
    expect(sql).toContain("deleted_at IS NULL");
    expect(sql).toMatch(/ORDER BY status = 'current' DESC, name COLLATE NOCASE, id/);
    expect(params).toEqual(["g1"]);
    expect(medicationsQuery("g1", { includeDeleted: true }).sql).not.toContain("deleted_at IS NULL");
  });

  it("filters by status and by every search word, in the name or the reason", () => {
    const { sql, params } = medicationsQuery("g1", { status: "discontinued", q: "  blood  lis " });
    expect(sql).toContain("status = ?");
    expect(sql.match(/name LIKE \?/g)).toHaveLength(2);
    expect(params).toEqual(["g1", "discontinued", "%blood%", "%blood%", "%lis%", "%lis%"]);
    expect(medicationsQuery("g1", { status: null, q: "" }).params).toEqual(["g1"]);
  });

  it("matches typed % and _ as themselves", () => {
    expect(medicationsQuery("g1", { q: "50%_a\\b" }).params.slice(1)).toEqual([
      "%50\\%\\_a\\\\b%",
      "%50\\%\\_a\\\\b%",
    ]);
  });

  it("reads a medication's doses and changes, or one of the two", () => {
    expect(medicationEntriesQuery(MEDICATION_ID).params).toEqual([MEDICATION_ID]);
    expect(medicationEntriesQuery(MEDICATION_ID).sql).toContain("kind IN ('dose', 'medicationChange')");
    expect(medicationEntriesQuery(MEDICATION_ID, "dose").params).toEqual(["dose", MEDICATION_ID]);
  });

  it("reads a day's doses between two moments, as the device stores times", () => {
    const { sql, params } = groupDosesQuery(
      "g1",
      "2026-11-17T08:00:00.000Z",
      new Date("2026-11-18T08:00:00.000Z"),
    );
    expect(sql).toContain("kind = 'dose'");
    expect(params).toEqual(["g1", "2026-11-17T08:00:00.000000Z", "2026-11-18T08:00:00.000000Z"]);
  });

  it("reads each name once, whatever its case", () => {
    expect(medicationNamesQuery("g1").sql).toContain("GROUP BY name COLLATE NOCASE");
  });

  it("lists doses and medication changes on the timeline, with a kind or without", () => {
    const all = entriesQuery("g1", { kind: null, author: null }, 50);
    expect(all.sql).toContain(
      "kind IN ('note', 'symptom', 'event', 'vital', 'dose', 'medicationChange', 'conditionChange')",
    );
    expect(all.params).toEqual(["g1", 51]);
    expect(entriesQuery("g1", { kind: "dose", author: null }, 50).params).toEqual(["g1", "dose", 51]);
  });
});

describe("days in the recipient's zone", () => {
  it("knows the recipient's day when the device is elsewhere", () => {
    // 05:30 UTC on the 18th is still the 17th in Los Angeles.
    const now = new Date("2026-11-18T05:30:00.000Z");
    expect(dayInZone(now, "America/Los_Angeles")).toBe("2026-11-17");
    expect(dayInZone(now, "America/New_York")).toBe("2026-11-18");
    expect(dayBounds(now, "America/Los_Angeles")).toEqual({
      day: "2026-11-17",
      from: new Date("2026-11-17T08:00:00.000Z"),
      to: new Date("2026-11-18T08:00:00.000Z"),
    });
  });

  it("gives a 23-hour day when the clocks go forward and a 25-hour one when they go back", () => {
    const hours = (at: string) => {
      const { from, to } = dayBounds(new Date(at), "America/Los_Angeles");
      return (to.getTime() - from.getTime()) / 3_600_000;
    };
    expect(hours("2026-03-08T20:00:00.000Z")).toBe(23);
    expect(hours("2026-11-01T20:00:00.000Z")).toBe(25);
    expect(dayBounds(new Date("2026-11-01T20:00:00.000Z"), "America/Los_Angeles").from).toEqual(
      new Date("2026-11-01T07:00:00.000Z"),
    );
  });
});
