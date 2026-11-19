import type { DueDose, DueMedication } from "./dueDoses";

import { describe, expect, it } from "vitest";
import { doseWarnings, dueDoses, dueNow } from "./dueDoses";

const LA = "America/Los_Angeles";
const NY = "America/New_York";
const MIN = 60_000;

const med = (over: Partial<DueMedication> & { id: string }): DueMedication => ({
  name: over.id,
  strength: null,
  dose: "1 tablet",
  schedule: { type: "scheduled", times: ["08:00", "20:00"] },
  status: "current",
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

let doseId = 0;
const dose = (
  medicationId: string,
  occurredAt: string,
  status: DueDose["details"]["status"] = "given",
  scheduledFor: string | null = null,
): DueDose => ({ id: `d${++doseId}`, occurredAt, details: { medicationId, status, scheduledFor } });

const plus = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * MIN);

// 8:00 and 20:00 in Los Angeles on 2026-11-19 (PST, UTC-8).
const AM = "2026-11-19T16:00:00.000Z";
const PM = "2026-11-20T04:00:00.000Z";

const run = (medications: DueMedication[], doses: DueDose[], now: Date, timeZone = LA) =>
  dueDoses({ medications, doses, now, timeZone });

const states = (result: ReturnType<typeof dueDoses>) => result.slots.map((s) => `${s.time} ${s.state}`);

describe("dueDoses", () => {
  it("places slots in the recipient's zone, whatever the device's", () => {
    // 11:00 in New York is 8:00 in Los Angeles.
    const now = new Date("2026-11-19T16:00:00Z");
    const la = run([med({ id: "a" })], [], now, LA);
    expect(la.day).toBe("2026-11-19");
    expect(la.slots.map((s) => s.at)).toEqual([AM, PM]);
    expect(states(la)).toEqual(["08:00 due", "20:00 upcoming"]);
    // A New York recipient's 8:00 was 3 hours ago.
    expect(states(run([med({ id: "a" })], [], now, NY))).toEqual(["08:00 overdue", "20:00 upcoming"]);
  });

  it("holds on the spring-forward day", () => {
    const m = med({ id: "a", schedule: { type: "scheduled", times: ["02:30", "08:00"] } });
    const result = run([m], [], new Date("2026-03-08T15:30:00Z")); // 8:30 PDT
    expect(result.day).toBe("2026-03-08");
    expect(result.slots.map((s) => [s.time, s.at, s.state])).toEqual([
      ["02:30", "2026-03-08T10:30:00.000Z", "overdue"],
      ["08:00", "2026-03-08T15:00:00.000Z", "due"],
    ]);
    // Yesterday was still PST.
    expect(result.yesterday.map((s) => s.at)).toEqual([
      "2026-03-07T10:30:00.000Z",
      "2026-03-07T16:00:00.000Z",
    ]);
  });

  it("holds on the fall-back day", () => {
    const m = med({ id: "a", schedule: { type: "scheduled", times: ["01:30", "08:00"] } });
    const result = run([m], [], new Date("2026-11-01T15:59:00Z")); // 7:59 PST
    expect(result.slots.map((s) => [s.time, s.at, s.state])).toEqual([
      ["01:30", "2026-11-01T08:30:00.000Z", "overdue"],
      ["08:00", "2026-11-01T16:00:00.000Z", "upcoming"],
    ]);
  });

  it("moves upcoming → due → overdue at the boundaries", () => {
    const m = [med({ id: "a", schedule: { type: "scheduled", times: ["08:00"] } })];
    expect(states(run(m, [], plus(AM, -1)))).toEqual(["08:00 upcoming"]);
    expect(states(run(m, [], new Date(AM)))).toEqual(["08:00 due"]);
    expect(states(run(m, [], plus(AM, 59)))).toEqual(["08:00 due"]);
    expect(states(run(m, [], plus(AM, 60)))).toEqual(["08:00 overdue"]);
    // Still today's, so never missed before midnight.
    expect(states(run(m, [], new Date("2026-11-20T07:59:00Z")))).toEqual(["08:00 overdue"]);
    expect(dueNow(run(m, [], plus(AM, 60))).map((s) => s.time)).toEqual(["08:00"]);
    expect(dueNow(run(m, [], plus(AM, -1)))).toEqual([]);
  });

  it("calls yesterday's unanswered slots missed once the day is over", () => {
    const m = [med({ id: "a" })];
    const now = new Date("2026-11-19T08:05:00Z"); // 0:05 on the 19th
    const result = run(m, [dose("a", "2026-11-18T16:10:00Z")], now);
    expect(result.yesterday.map((s) => `${s.time} ${s.state}`)).toEqual(["08:00 given", "20:00 missed"]);
    expect(result.missed.map((s) => s.time)).toEqual(["20:00"]);
    expect(states(result)).toEqual(["08:00 upcoming", "20:00 upcoming"]);
  });

  it("matches a late log within the window, and not past it", () => {
    const m = [med({ id: "a" })];
    expect(states(run(m, [dose("a", plus(AM, 105).toISOString())], plus(AM, 110)))).toEqual([
      "08:00 given",
      "20:00 upcoming",
    ]);
    expect(states(run(m, [dose("a", plus(AM, 150).toISOString())], plus(AM, 160)))).toEqual([
      "08:00 overdue",
      "20:00 upcoming",
    ]);
  });

  it("lets scheduledFor name the slot, ahead of the nearest", () => {
    const m = [med({ id: "a" })];
    // At 19:30, named for 8:00: the 8:00 slot, though 20:00 is nearer.
    const named = run(m, [dose("a", plus(PM, -30).toISOString(), "given", "08:00")], plus(PM, -20));
    expect(states(named)).toEqual(["08:00 given", "20:00 upcoming"]);
    // Unnamed, the same dose answers 20:00.
    const unnamed = run(m, [dose("a", plus(PM, -30).toISOString())], plus(PM, -20));
    expect(states(unnamed)).toEqual(["08:00 overdue", "20:00 given"]);
    // A named dose takes its slot before an unnamed one, logged earlier, can.
    const both = run(
      m,
      [dose("a", plus(AM, 5).toISOString()), dose("a", plus(AM, 10).toISOString(), "skipped", "08:00")],
      plus(AM, 20),
    );
    expect(states(both)).toEqual(["08:00 skipped", "20:00 upcoming"]);
  });

  it("never moves a second dose named for an answered slot onto another one", () => {
    const m = [med({ id: "a", schedule: { type: "scheduled", times: ["08:00", "09:00"] } })];
    const result = run(
      m,
      [
        dose("a", plus(AM, 5).toISOString(), "given", "08:00"),
        dose("a", plus(AM, 30).toISOString(), "given", "08:00"),
      ],
      plus(AM, 61),
    );
    expect(states(result)).toEqual(["08:00 given", "09:00 due"]);
  });

  it("matches a dose named for a time the schedule no longer has like an unnamed one", () => {
    const result = run(
      [med({ id: "a" })],
      [dose("a", plus(AM, 20).toISOString(), "given", "07:30")],
      plus(AM, 30),
    );
    expect(states(result)).toEqual(["08:00 given", "20:00 upcoming"]);
  });

  it("matches a late-night slot answered after midnight to yesterday", () => {
    const m = [med({ id: "a", schedule: { type: "scheduled", times: ["23:30"] } })];
    const now = new Date("2026-11-19T08:30:00Z"); // 0:30 on the 19th
    const result = run(m, [dose("a", "2026-11-19T08:15:00Z", "refused", "23:30")], now);
    expect(result.yesterday.map((s) => s.state)).toEqual(["refused"]);
    expect(result.missed).toEqual([]);
    expect(states(result)).toEqual(["23:30 upcoming"]);
  });

  it("only matches doses of the same medication", () => {
    const result = run(
      [med({ id: "a" }), med({ id: "b" })],
      [dose("b", plus(AM, 5).toISOString())],
      plus(AM, 10),
    );
    expect(result.slots.map((s) => `${s.medication.id} ${s.time} ${s.state}`)).toEqual([
      "a 08:00 due",
      "b 08:00 given",
      "a 20:00 upcoming",
      "b 20:00 upcoming",
    ]);
  });

  it("ignores completed, discontinued and deleted medications", () => {
    const result = run(
      [
        med({ id: "done", status: "completed" }),
        med({ id: "stopped", status: "discontinued" }),
        med({ id: "gone", deletedAt: "2026-11-18T00:00:00.000Z" }),
        med({ id: "prn-gone", schedule: { type: "asNeeded", maxPerDay: 2 }, status: "discontinued" }),
      ],
      [],
      new Date(AM),
    );
    expect(result.slots).toEqual([]);
    expect(result.yesterday).toEqual([]);
    expect(result.asNeeded).toEqual([]);
  });

  it("has no slots before a medication was added or started", () => {
    const addedToday = med({ id: "a", createdAt: "2026-11-19T15:00:00.000Z" });
    const startsTomorrow = med({ id: "b", startedOn: "2026-11-20" });
    const result = run([addedToday, startsTomorrow], [], plus(AM, 10));
    expect(result.yesterday).toEqual([]);
    expect(result.slots.map((s) => `${s.medication.id} ${s.time}`)).toEqual(["a 08:00", "a 20:00"]);
  });

  it("counts today's given as-needed doses against the maximum", () => {
    const prn = med({ id: "p", schedule: { type: "asNeeded", maxPerDay: 3 } });
    const open = med({ id: "q", schedule: { type: "asNeeded" } });
    const result = run(
      [prn, open],
      [
        dose("p", "2026-11-18T20:00:00Z"), // yesterday
        dose("p", plus(AM, -60).toISOString()),
        dose("p", plus(AM, 60).toISOString()),
        dose("p", plus(AM, 90).toISOString(), "refused"),
      ],
      plus(AM, 120),
    );
    expect(result.slots).toEqual([]);
    expect(result.asNeeded.map((a) => [a.medication.id, a.count, a.max, a.left])).toEqual([
      ["p", 2, 3, 1],
      ["q", 0, null, null],
    ]);
  });
});

describe("doseWarnings", () => {
  const m = [med({ id: "a" })];

  it("warns before a second dose for a slot already given", () => {
    const due = run(m, [dose("a", plus(AM, 5).toISOString(), "given", "08:00")], plus(AM, 30));
    const now = plus(AM, 30);
    expect(doseWarnings(due, { medicationId: "a", status: "given", scheduledFor: "08:00" }, now)).toEqual([
      { type: "alreadyGiven", time: "08:00", givenAt: plus(AM, 5).toISOString() },
    ]);
    // With no slot named, the 8:00 slot is the only one near: the same warning.
    expect(doseWarnings(due, { medicationId: "a", status: "given" }, now)).toEqual([
      { type: "alreadyGiven", time: "08:00", givenAt: plus(AM, 5).toISOString() },
    ]);
    // Skipping or refusing can't double a dose; the 20:00 slot is still open.
    expect(doseWarnings(due, { medicationId: "a", status: "skipped", scheduledFor: "08:00" }, now)).toEqual(
      [],
    );
    expect(doseWarnings(due, { medicationId: "a", status: "given", scheduledFor: "20:00" }, now)).toEqual([]);
  });

  it("doesn't warn while an open slot is near, or for a skipped slot", () => {
    const open = run(m, [], plus(AM, 30));
    expect(doseWarnings(open, { medicationId: "a", status: "given" }, plus(AM, 30))).toEqual([]);
    const skipped = run(m, [dose("a", plus(AM, 5).toISOString(), "skipped", "08:00")], plus(AM, 30));
    expect(
      doseWarnings(skipped, { medicationId: "a", status: "given", scheduledFor: "08:00" }, plus(AM, 30)),
    ).toEqual([]);
  });

  it("warns past an as-needed maximum, today only", () => {
    const prn = [med({ id: "p", schedule: { type: "asNeeded", maxPerDay: 2 } })];
    const doses = [dose("p", plus(AM, -60).toISOString()), dose("p", plus(AM, 0).toISOString())];
    const due = run(prn, doses, plus(AM, 30));
    expect(doseWarnings(due, { medicationId: "p", status: "given" }, plus(AM, 30))).toEqual([
      { type: "overMax", count: 2, max: 2 },
    ]);
    // Logged on an earlier day, today's count doesn't apply.
    expect(
      doseWarnings(
        due,
        { medicationId: "p", status: "given", occurredAt: "2026-11-17T20:00:00Z" },
        plus(AM, 30),
      ),
    ).toEqual([]);
    // One below the maximum: no warning.
    const under = run(prn, doses.slice(0, 1), plus(AM, 30));
    expect(doseWarnings(under, { medicationId: "p", status: "given" }, plus(AM, 30))).toEqual([]);
    // No maximum: never.
    const open = run([med({ id: "q", schedule: { type: "asNeeded" } })], [dose("q", AM)], plus(AM, 30));
    expect(doseWarnings(open, { medicationId: "q", status: "given" }, plus(AM, 30))).toEqual([]);
  });
});
