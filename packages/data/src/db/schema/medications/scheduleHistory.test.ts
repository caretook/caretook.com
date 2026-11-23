import type { MedicationSchedule } from "./medication";
import type { ScheduleChange, ScheduleHistoryMedication } from "./scheduleHistory";

import { describe, expect, it } from "vitest";
import { scheduleHistory } from "./scheduleHistory";

// Los Angeles, November 2026 (PST, UTC-8): 10:00 local is 18:00 UTC.
const LA = "America/Los_Angeles";
const MED = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d4001";
const MORNING = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d4002";

const timed = (...times: string[]): MedicationSchedule => ({
  type: "scheduled",
  slots: times.map((time) => ({ time })),
});
const inPass: MedicationSchedule = { type: "scheduled", slots: [{ passId: MORNING }] };

const med = (over: Partial<ScheduleHistoryMedication> = {}): ScheduleHistoryMedication => ({
  id: MED,
  schedule: timed("08:00", "20:00"),
  status: "current",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

let n = 0;
const entry = (occurredAt: string, details: object): ScheduleChange => ({
  id: `c${++n}`,
  occurredAt,
  details,
});
const edited = (occurredAt: string, before: unknown, after: unknown) =>
  entry(occurredAt, {
    medicationId: MED,
    change: "changed",
    fields: ["schedule"],
    before: { schedule: before },
    after: { schedule: after },
  });
const moved = (occurredAt: string, beforeTime: string, afterTime: string) =>
  entry(occurredAt, {
    change: "passMoved",
    passId: MORNING,
    passName: "Morning",
    beforeTime,
    afterTime,
    medicationIds: [MED],
  });
const status = (occurredAt: string, change: "started" | "stopped" | "resumed") =>
  entry(occurredAt, { medicationId: MED, change });

const times = (h: ReturnType<typeof scheduleHistory>, day: string) => h.slotsOn(day).map((s) => s.time);

describe("scheduleHistory", () => {
  it("a slot added mid-range exists from its day, and not that day once its time had passed", () => {
    const change = edited("2026-11-18T18:00:00.000Z", timed("08:00"), timed("08:00", "09:00", "20:00"));
    const h = scheduleHistory({
      medication: med({ schedule: timed("08:00", "09:00", "20:00") }),
      changes: [change],
      timeZone: LA,
    });
    expect(times(h, "2026-11-17")).toEqual(["08:00"]);
    // Added at 10:00: 09:00 had passed, 20:00 hadn't.
    expect(times(h, "2026-11-18")).toEqual(["08:00", "20:00"]);
    expect(times(h, "2026-11-19")).toEqual(["08:00", "09:00", "20:00"]);
  });

  it("a removed slot exists until the day before the edit took it away", () => {
    const change = edited("2026-11-18T18:00:00.000Z", timed("08:00", "20:00"), timed("08:00"));
    const h = scheduleHistory({
      medication: med({ schedule: timed("08:00") }),
      changes: [change],
      timeZone: LA,
    });
    expect(times(h, "2026-11-17")).toEqual(["08:00", "20:00"]);
    expect(times(h, "2026-11-18")).toEqual(["08:00"]);
  });

  it("a pass moved by more than two hours has its old time before, and one slot on the day it moved", () => {
    const h = scheduleHistory({
      medication: med({ schedule: inPass }),
      passes: [{ id: MORNING, time: "11:00" }],
      changes: [moved("2026-11-18T18:00:00.000Z", "08:00", "11:00")],
      timeZone: LA,
    });
    expect(times(h, "2026-11-17")).toEqual(["08:00"]);
    expect(h.slotsOn("2026-11-18").map((s) => [s.time, s.passId])).toEqual([["11:00", MORNING]]);
    expect(times(h, "2026-11-19")).toEqual(["11:00"]);
  });

  it("a stop then a resume leaves no slots between", () => {
    const h = scheduleHistory({
      medication: med({ schedule: timed("09:00") }),
      changes: [status("2026-11-15T20:00:00.000Z", "stopped"), status("2026-11-18T18:00:00.000Z", "resumed")],
      timeZone: LA,
    });
    expect(times(h, "2026-11-14")).toEqual(["09:00"]);
    for (const day of ["2026-11-15", "2026-11-16", "2026-11-17"]) {
      expect(h.takenOn(day)).toBe(false);
      expect(times(h, day)).toEqual([]);
    }
    // Resumed at 10:00: that day's 09:00 had passed; the next day's counts.
    expect(h.takenOn("2026-11-18")).toBe(true);
    expect(times(h, "2026-11-18")).toEqual([]);
    expect(times(h, "2026-11-19")).toEqual(["09:00"]);
  });

  it("a medication added at 15:00 has no 08:00 slot that day", () => {
    const h = scheduleHistory({
      medication: med({ createdAt: "2026-11-18T23:00:00.000Z" }),
      changes: [status("2026-11-18T23:00:00.000Z", "started")],
      timeZone: LA,
    });
    expect(times(h, "2026-11-18")).toEqual(["20:00"]);
    expect(times(h, "2026-11-19")).toEqual(["08:00", "20:00"]);
  });

  it("reads a change entry deleted from the timeline like any other", () => {
    const change = {
      ...edited("2026-11-18T18:00:00.000Z", timed("08:00"), timed("08:00", "20:00")),
      deletedAt: "2026-11-19T00:00:00.000Z",
    };
    const h = scheduleHistory({ medication: med(), changes: [change], timeZone: LA });
    expect(times(h, "2026-11-17")).toEqual(["08:00"]);
  });

  it("with no entries, or across a gap, reads the present schedule", () => {
    const none = scheduleHistory({ medication: med(), changes: [], timeZone: LA });
    expect(times(none, "2026-11-10")).toEqual(["08:00", "20:00"]);

    // Present 08:00 + 21:00; the entry's `after` says 08:00 + 20:00, so something unrecorded came between.
    const h = scheduleHistory({
      medication: med({ schedule: timed("08:00", "21:00") }),
      changes: [edited("2026-11-10T18:00:00.000Z", timed("08:00"), timed("08:00", "20:00"))],
      timeZone: LA,
    });
    expect(times(h, "2026-11-15")).toEqual(["08:00", "21:00"]);
    expect(times(h, "2026-11-09")).toEqual(["08:00"]);
  });

  it("reads an old-shape schedule in an entry", () => {
    const h = scheduleHistory({
      medication: med({ schedule: timed("08:00", "20:00") }),
      changes: [
        edited("2026-11-18T18:00:00.000Z", { type: "scheduled", times: ["07:30"] }, timed("08:00", "20:00")),
      ],
      timeZone: LA,
    });
    expect(times(h, "2026-11-17")).toEqual(["07:30"]);
  });

  it("falls back to stoppedOn when no entry records the stop", () => {
    const h = scheduleHistory({
      medication: med({ status: "discontinued", stoppedOn: "2026-11-18" }),
      timeZone: LA,
    });
    expect(h.takenOn("2026-11-17")).toBe(true);
    expect(h.takenOn("2026-11-18")).toBe(false);
  });

  it("a time that was a pass's when given names that pass; one its day no longer has names nothing", () => {
    const h = scheduleHistory({
      medication: med({ schedule: inPass }),
      passes: [{ id: MORNING, time: "11:00" }],
      changes: [moved("2026-11-18T18:00:00.000Z", "08:00", "11:00")],
      timeZone: LA,
    });
    const at = { occurredAt: "2026-11-18T16:00:00.000Z", details: { scheduledFor: "08:00" } };
    expect(h.doseName(at)).toEqual({ passId: MORNING, scheduledFor: "08:00" });

    const edit = scheduleHistory({
      medication: med({ schedule: timed("09:00") }),
      changes: [edited("2026-11-18T17:00:00.000Z", timed("08:00"), timed("09:00"))],
      timeZone: LA,
    });
    expect(edit.doseName(at)).toEqual({});
  });
});
