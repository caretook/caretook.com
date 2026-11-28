import type { PassRow } from "./medicationPasses.sync";
import type { MedicationRow, RecipientRow } from "./medications.sync";
import type { EntryRow } from "../timeline/timeline.sync";
import type { PrepMedication, VisitPrepData, VisitWindow } from "../appointments/visitPrep";

import { REMOVED_PASS, resolveUnits, scheduleText } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import { visitPrepSection } from "../appointments/visitPrep";
import { toDueDoses } from "./dueDoses.sync";
import { toPass, toPasses } from "./medicationPasses.sync";

// A deleted pass's name is scrubbed (data-rights): it stays a pass, so the
// schedules that named it keep its time, and the missed doses read from them
// are the same as before the delete.

const ZONE = "America/Los_Angeles";
// A uuid: schedules in change entries are parsed.
const PASS_AM = "5f0c2d1e-7a3b-4c8d-9e6f-1a2b3c4d5e6f";
const AT = "2026-11-01T16:00:00.000000Z";

const passRow = (overrides: Partial<PassRow> = {}): PassRow => ({
  id: PASS_AM,
  group_id: "g1",
  recipient_id: "r1",
  name: "Morning",
  time: "08:00",
  sort_order: 0,
  deleted_at: null,
  created_at: AT,
  updated_at: AT,
  created_by: "u1",
  updated_by: "u1",
  ...overrides,
});
/** The row as the delete's trigger leaves it: no name, its time kept. */
const SCRUBBED = passRow({ name: "", deleted_at: "2026-11-19T08:15:00.000000Z" });

describe("toPass", () => {
  it("reads a live pass", () => {
    expect(toPass(passRow())).toEqual({
      id: PASS_AM,
      groupId: "g1",
      recipientId: "r1",
      name: "Morning",
      time: "08:00",
      sortOrder: 0,
      deletedAt: null,
    });
  });

  it("keeps a deleted pass whose name the delete cleared, with its time", () => {
    expect(toPass(SCRUBBED)).toMatchObject({ id: PASS_AM, name: "", time: "08:00" });
    expect(toPass(SCRUBBED)?.deletedAt).toBeTruthy();
    expect(toPass({ ...SCRUBBED, name: null })).toMatchObject({ name: "", time: "08:00" });
    expect(
      toPasses([
        SCRUBBED,
        passRow({ id: "0b9e6a3c-4a51-4f0e-9a7e-2c6d1f8e7b21", name: "Evening", time: "20:00" }),
      ]),
    ).toHaveLength(2);
  });

  it("drops a half-synced row: a live one with no name, or any with no group or time", () => {
    expect(toPass(passRow({ name: "" }))).toBeNull();
    expect(toPass(passRow({ name: null }))).toBeNull();
    expect(toPass(passRow({ group_id: null }))).toBeNull();
    expect(toPass({ ...SCRUBBED, time: null })).toBeNull();
  });

  it("names a deleted pass Removed med time in a schedule", () => {
    const schedule = { type: "scheduled" as const, slots: [{ passId: PASS_AM }, { time: "20:00" }] };
    expect(scheduleText(schedule, toPasses([SCRUBBED]))).toBe(`${REMOVED_PASS} and 20:00`);
  });
});

// --- Schedule history: an old schedule naming the deleted pass ----------------

// Thu Nov 19, 10:00 in Los Angeles. Lisinopril was in Morning (08:00) until
// 00:30 today, when its schedule moved to a time of its own; Morning was
// deleted after. Yesterday's Morning dose was never logged.
const NOW = new Date("2026-11-19T18:00:00Z");
const MORNING = { type: "scheduled", slots: [{ passId: PASS_AM }] };
const OWN = { type: "scheduled", slots: [{ time: "09:00" }] };

const medicationRow: MedicationRow = {
  id: "m-lis",
  group_id: "g1",
  recipient_id: "r1",
  name: "Lisinopril",
  strength: "10 mg",
  form: null,
  dose: "1 tablet",
  directions: null,
  reason: null,
  schedule: JSON.stringify(OWN),
  status: "current",
  started_on: null,
  stopped_on: null,
  stop_reason: null,
  stop_note: null,
  prescriber_id: null,
  pharmacy_id: null,
  last_filled_on: null,
  quantity: null,
  refills_left: null,
  rx_number: null,
  type: null,
  deleted_at: null,
  created_at: AT,
  updated_at: AT,
  created_by: "u1",
  updated_by: "u1",
};
const changeRow: EntryRow = {
  id: "c-own",
  group_id: "g1",
  recipient_id: "r1",
  kind: "medicationChange",
  occurred_at: "2026-11-19T08:30:00.000000Z",
  time_zone: ZONE,
  title: null,
  body: null,
  details: JSON.stringify({
    medicationId: "m-lis",
    change: "changed",
    fields: ["schedule"],
    before: { schedule: MORNING },
    after: { schedule: OWN },
  }),
  deleted_at: null,
  created_at: "2026-11-19T08:30:00.000000Z",
  updated_at: "2026-11-19T08:30:00.000000Z",
  created_by: "u1",
  updated_by: "u1",
};
const recipientRow: RecipientRow = {
  id: "r1",
  group_id: "g1",
  name: "Sam",
  preferred_name: null,
  time_zone: ZONE,
  date_of_birth: null,
};

describe("toDueDoses with a deleted pass", () => {
  const missedWith = (pass: PassRow) =>
    toDueDoses(
      {
        medications: [medicationRow],
        passes: [pass],
        doses: [],
        changes: [changeRow],
        recipient: [recipientRow],
      },
      NOW,
    ).missed.map((s) => [s.medication.id, s.day, s.time, s.passId]);

  it("still misses yesterday's dose at its time, as while it was live", () => {
    const live = missedWith(passRow());
    expect(live).toEqual([["m-lis", "2026-11-18", "08:00", PASS_AM]]);
    expect(missedWith(SCRUBBED)).toEqual(live);
  });
});

describe("visit prep with a deleted pass", () => {
  const window: VisitWindow = { from: "2026-11-15T17:00:00Z", to: NOW.toISOString(), lastVisit: null };
  const lisinopril: PrepMedication = {
    id: "m-lis",
    name: "Lisinopril",
    strength: "10 mg",
    dose: "1 tablet",
    status: "current",
    schedule: OWN as PrepMedication["schedule"],
    deletedAt: null,
  };
  const missedLines = (pass: PassRow) => {
    const data: VisitPrepData = {
      entries: [],
      medications: [lisinopril],
      // Nov 16's Morning dose given; Nov 17's and 18's nothing.
      doses: [
        {
          id: "d16",
          occurredAt: "2026-11-16T16:02:00.000Z",
          details: { medicationId: "m-lis", status: "given", scheduledFor: "08:00", passId: PASS_AM },
        },
      ],
      changes: [
        { id: "c-own", occurredAt: "2026-11-19T08:30:00.000Z", details: JSON.parse(changeRow.details!) },
      ],
      passes: toPasses([pass]),
      periods: [],
      placeNames: new Map(),
      appointmentId: "appt",
      units: resolveUnits(null),
      timeZone: ZONE,
      now: NOW,
    };
    const lines = visitPrepSection(data, window).map((l) => l.text);
    return lines.filter((l) => l.startsWith("Lisinopril 10 mg:"));
  };

  it("counts the old schedule's missed doses as while the pass was live", () => {
    const live = missedLines(passRow());
    expect(live).toEqual(["Lisinopril 10 mg: 2 missed (of 3)"]);
    expect(missedLines(SCRUBBED)).toEqual(live);
  });
});
