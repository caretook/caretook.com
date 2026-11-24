import type { DueDose, DueMedication } from "./dueDoses";

import { normalizeSchedule } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import { doseSlotsBetween, doseWarnings, dueDoses, dueNow, missedDoseCounts } from "./dueDoses";

const LA = "America/Los_Angeles";
const NY = "America/New_York";
const MIN = 60_000;

const med = (over: Partial<DueMedication> & { id: string }): DueMedication => ({
  name: over.id,
  strength: null,
  dose: "1 tablet",
  schedule: { type: "scheduled", slots: [{ time: "08:00" }, { time: "20:00" }] },
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
    const m = med({
      id: "a",
      schedule: { type: "scheduled", slots: [{ time: "02:30" }, { time: "08:00" }] },
    });
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
    const m = med({
      id: "a",
      schedule: { type: "scheduled", slots: [{ time: "01:30" }, { time: "08:00" }] },
    });
    const result = run([m], [], new Date("2026-11-01T15:59:00Z")); // 7:59 PST
    expect(result.slots.map((s) => [s.time, s.at, s.state])).toEqual([
      ["01:30", "2026-11-01T08:30:00.000Z", "overdue"],
      ["08:00", "2026-11-01T16:00:00.000Z", "upcoming"],
    ]);
  });

  it("moves upcoming → due → overdue at the boundaries", () => {
    const m = [med({ id: "a", schedule: { type: "scheduled", slots: [{ time: "08:00" }] } })];
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
    const m = [
      med({ id: "a", schedule: { type: "scheduled", slots: [{ time: "08:00" }, { time: "09:00" }] } }),
    ];
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
    const m = [med({ id: "a", schedule: { type: "scheduled", slots: [{ time: "23:30" }] } })];
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

describe("dueDoses with passes", () => {
  const MORNING = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1001";
  const EVENING = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1002";
  const passes = (morning = "08:00", evening = "20:00") => [
    { id: MORNING, time: morning },
    { id: EVENING, time: evening },
  ];
  const inPasses = (over: Partial<DueMedication> & { id: string }) =>
    med({
      schedule: {
        type: "scheduled",
        slots: [{ passId: MORNING, amount: "1000 mg" }, { passId: EVENING }, { time: "14:00" }],
      },
      ...over,
    });
  const passDose = (medicationId: string, occurredAt: string, passId: string, scheduledFor: string) => ({
    id: `d${++doseId}`,
    occurredAt,
    details: { medicationId, status: "given" as const, scheduledFor, passId },
  });
  const runWith = (medications: DueMedication[], doses: DueDose[], now: Date, p = passes(), timeZone = LA) =>
    dueDoses({ medications, passes: p, doses, now, timeZone });

  it("places pass slots at their pass's time, with the slot's amount, else the dose", () => {
    const result = runWith([inPasses({ id: "a" })], [], plus(AM, 10));
    expect(result.slots.map((s) => [s.time, s.passId, s.amount, s.state])).toEqual([
      ["08:00", MORNING, "1000 mg", "due"],
      ["14:00", null, "1 tablet", "upcoming"],
      ["20:00", EVENING, "1 tablet", "upcoming"],
    ]);
    // A pass this device doesn't know has no slot.
    expect(runWith([inPasses({ id: "a" })], [], plus(AM, 10), []).slots.map((s) => s.time)).toEqual([
      "14:00",
    ]);
  });

  it("keeps a retimed pass's answered dose, and makes the new time due", () => {
    // Given at 8:05 for the Morning pass; then Morning moved to 9:30, Evening to 10:00.
    const given = passDose("a", plus(AM, 5).toISOString(), MORNING, "08:00");
    const result = runWith([inPasses({ id: "a" })], [given], plus(AM, 125), passes("09:30", "10:00"));
    expect(result.slots.map((s) => `${s.time} ${s.state}`)).toEqual([
      "09:30 given",
      "10:00 due",
      "14:00 upcoming",
    ]);
    expect(result.slots[0]?.dose).toBe(given);
  });

  it("answers a pass slot by its time when the dose names no pass (an older build's)", () => {
    const old = dose("a", plus(PM, -30).toISOString(), "given", "08:00");
    const result = runWith([inPasses({ id: "a" })], [old], plus(PM, -20));
    expect(states(result)).toEqual(["08:00 given", "14:00 overdue", "20:00 upcoming"]);
  });

  it("ignores a pass the medication isn't in, matching the dose like an unnamed one", () => {
    const m = med({ id: "a", schedule: { type: "scheduled", slots: [{ passId: EVENING }] } });
    // Logged in the Morning pass at 19:45 (a mistake): it answers the nearby Evening slot.
    const result = runWith(
      [m],
      [passDose("a", plus(PM, -15).toISOString(), MORNING, "08:00")],
      plus(PM, -10),
    );
    expect(states(result)).toEqual(["20:00 given"]);
  });

  it("keeps one slot when a pass and a time of its own fall together", () => {
    const m = med({
      id: "a",
      schedule: { type: "scheduled", slots: [{ time: "08:00" }, { passId: MORNING }] },
    });
    expect(runWith([m], [], plus(AM, 10)).slots.map((s) => [s.time, s.passId])).toEqual([["08:00", MORNING]]);
  });

  it("holds pass slots on the spring-forward day", () => {
    const early = [
      { id: MORNING, time: "02:30" },
      { id: EVENING, time: "20:00" },
    ];
    const m = med({ id: "a", schedule: { type: "scheduled", slots: [{ passId: MORNING }] } });
    const result = runWith([m], [], new Date("2026-03-08T15:30:00Z"), early);
    expect(result.slots.map((s) => [s.time, s.at])).toEqual([["02:30", "2026-03-08T10:30:00.000Z"]]);
  });

  it("reads an old-shape schedule (times) as time slots", () => {
    const m = med({
      id: "a",
      schedule: normalizeSchedule({ type: "scheduled", times: ["20:00", "08:00"] }) ?? { type: "asNeeded" },
    });
    expect(states(runWith([m], [], plus(AM, 10)))).toEqual(["08:00 due", "20:00 upcoming"]);
  });

  it("warns before a second dose in a pass already given, even after the pass moved", () => {
    const due = runWith(
      [inPasses({ id: "a" })],
      [passDose("a", plus(AM, 5).toISOString(), MORNING, "08:00")],
      plus(AM, 125),
      passes("09:30", "20:00"),
    );
    expect(
      doseWarnings(
        due,
        { medicationId: "a", status: "given", passId: MORNING, scheduledFor: "09:30" },
        plus(AM, 125),
      ),
    ).toEqual([{ type: "alreadyGiven", time: "09:30", givenAt: plus(AM, 5).toISOString() }]);
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

describe("doseSlotsBetween (a range of days: visit prep's missed doses)", () => {
  const MORNING = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d2001";
  const between = (
    medications: DueMedication[],
    doses: DueDose[],
    from: string,
    to: string,
    passes: { id: string; time: string }[] = [],
  ) => doseSlotsBetween({ medications, passes, doses, from, to, timeZone: LA });
  const tally = (slots: ReturnType<typeof doseSlotsBetween>) =>
    slots.reduce<Record<string, number>>((t, s) => ({ ...t, [s.state]: (t[s.state] ?? 0) + 1 }), {});

  it("expands every day's slots across the fall-back change, in the recipient's zone", () => {
    // Oct 31 to Nov 2: 8:00 is 15:00 UTC on PDT days and 16:00 on PST days.
    // To Nov 3, 0:30: Nov 2 is over, so its slots are missed.
    const slots = between([med({ id: "a" })], [], "2026-10-31T07:00:00Z", "2026-11-03T08:30:00Z");
    expect(slots.filter((s) => s.time === "08:00").map((s) => s.at)).toEqual([
      "2026-10-31T15:00:00.000Z",
      "2026-11-01T16:00:00.000Z",
      "2026-11-02T16:00:00.000Z",
    ]);
    expect(tally(slots)).toEqual({ missed: 6 });
  });

  it("holds on the spring-forward day: a skipped 2:30 moves on by the gap", () => {
    const m = med({ id: "a", schedule: { type: "scheduled", slots: [{ time: "02:30" }] } });
    const slots = between([m], [], "2026-03-07T08:00:00Z", "2026-03-09T07:00:00Z");
    expect(slots.map((s) => [s.day, s.at])).toEqual([
      ["2026-03-07", "2026-03-07T10:30:00.000Z"],
      ["2026-03-08", "2026-03-08T10:30:00.000Z"],
    ]);
  });

  it("answers slots as dueDoses does, missed only once the day is over, and leaves out slots outside the range", () => {
    const doses = [
      dose("a", "2026-11-17T16:05:00Z"), // Nov 17 8:00 given
      dose("a", "2026-11-17T04:10:00Z", "refused", "20:00"), // Nov 16 20:00 refused
      dose("a", "2026-11-18T16:00:00Z", "skipped", "08:00"), // Nov 18 8:00 skipped
    ];
    // From Nov 16 noon to Nov 19 9:00: Nov 16 20:00 … Nov 19 8:00.
    const slots = between([med({ id: "a" })], doses, "2026-11-16T20:00:00Z", "2026-11-19T17:00:00Z");
    expect(slots.map((s) => `${s.day} ${s.time} ${s.state}`)).toEqual([
      "2026-11-16 20:00 refused",
      "2026-11-17 08:00 given",
      "2026-11-17 20:00 missed",
      "2026-11-18 08:00 skipped",
      "2026-11-18 20:00 missed",
      "2026-11-19 08:00 overdue",
    ]);
    expect(missedDoseCounts(slots)).toMatchObject([{ missed: 2, skipped: 1, refused: 1, slots: 5 }]);
  });

  it("keeps a retimed pass's answered doses: they answer the pass's slot by its id", () => {
    // Given at 8:00 every day in the Morning pass, then Morning was moved to 9:30.
    const m = med({ id: "a", schedule: { type: "scheduled", slots: [{ passId: MORNING }] } });
    const doses = ["2026-11-16", "2026-11-17", "2026-11-18"].map((day) => ({
      id: `d${++doseId}`,
      occurredAt: `${day}T16:00:00.000Z`,
      details: { medicationId: "a", status: "given" as const, scheduledFor: "08:00", passId: MORNING },
    }));
    const slots = between([m], doses, "2026-11-16T08:00:00Z", "2026-11-19T08:00:00Z", [
      { id: MORNING, time: "09:30" },
    ]);
    expect(slots.map((s) => `${s.time} ${s.state}`)).toEqual(["09:30 given", "09:30 given", "09:30 given"]);
    expect(missedDoseCounts(slots)).toEqual([]);
  });

  it("counts a stopped medication up to the day it stopped, and none before it was added or started", () => {
    const stopped = med({ id: "s", status: "discontinued", stoppedOn: "2026-11-18" });
    const added = med({ id: "n", createdAt: "2026-11-18T20:00:00.000Z" });
    const late = med({ id: "l", startedOn: "2026-11-18" });
    const gone = med({ id: "g", deletedAt: "2026-11-18T00:00:00.000Z" });
    const slots = between([stopped, added, late, gone], [], "2026-11-16T08:00:00Z", "2026-11-20T08:00:00Z");
    const days = (id: string) => [...new Set(slots.filter((s) => s.medication.id === id).map((s) => s.day))];
    expect(days("s")).toEqual(["2026-11-16", "2026-11-17"]);
    expect(days("n")).toEqual(["2026-11-18", "2026-11-19"]);
    expect(days("l")).toEqual(["2026-11-18", "2026-11-19"]);
    expect(days("g")).toEqual([]);
  });

  it("reads each day through its own schedule: no misses before an added slot", () => {
    const m = med({
      id: "a",
      schedule: { type: "scheduled", slots: [{ time: "08:00" }, { time: "20:00" }] },
    });
    const changes = [
      {
        id: "c1",
        occurredAt: "2026-11-18T18:00:00.000Z", // Nov 18, 10:00: the evening slot added
        details: {
          medicationId: "a",
          change: "changed",
          fields: ["schedule"],
          before: { schedule: { type: "scheduled", slots: [{ time: "08:00" }] } },
          after: { schedule: m.schedule },
        },
      },
    ];
    const doses = ["2026-11-16", "2026-11-17", "2026-11-18"].map((day) =>
      dose("a", `${day}T16:00:00.000Z`, "given", "08:00"),
    );
    const slots = doseSlotsBetween({
      medications: [m],
      doses,
      changes,
      from: "2026-11-16T08:00:00Z",
      to: "2026-11-19T08:00:00Z",
      timeZone: LA,
    });
    expect(slots.map((s) => `${s.day} ${s.time} ${s.state}`)).toEqual([
      "2026-11-16 08:00 given",
      "2026-11-17 08:00 given",
      "2026-11-18 08:00 given",
      "2026-11-18 20:00 missed",
    ]);
    expect(missedDoseCounts(slots)).toMatchObject([{ missed: 1, slots: 4 }]);
  });

  it("doses logged without a pass before a three-hour move still answer their slots, on the day it moved too", () => {
    const m = med({ id: "a", schedule: { type: "scheduled", slots: [{ passId: MORNING }] } });
    const changes = [
      {
        id: "c1",
        occurredAt: "2026-11-18T18:00:00.000Z", // Nov 18, 10:00: Morning moved 08:00 to 11:00
        details: {
          change: "passMoved",
          passId: MORNING,
          passName: "Morning",
          beforeTime: "08:00",
          afterTime: "11:00",
          medicationIds: ["a"],
        },
      },
    ];
    const doses = ["2026-11-16", "2026-11-17", "2026-11-18"].map((day) =>
      dose("a", `${day}T16:00:00.000Z`, "given", "08:00"),
    );
    const slots = doseSlotsBetween({
      medications: [m],
      passes: [{ id: MORNING, time: "11:00" }],
      doses,
      changes,
      from: "2026-11-16T08:00:00Z",
      to: "2026-11-19T08:00:00Z",
      timeZone: LA,
    });
    expect(slots.map((s) => `${s.day} ${s.time} ${s.state}`)).toEqual([
      "2026-11-16 08:00 given",
      "2026-11-17 08:00 given",
      "2026-11-18 11:00 given",
    ]);
  });

  it("with no entries reads exactly as without them", () => {
    const m = med({ id: "a" });
    const input = {
      medications: [m],
      doses: [],
      from: "2026-11-16T08:00:00Z",
      to: "2026-11-19T08:00:00Z",
      timeZone: LA,
    };
    expect(doseSlotsBetween({ ...input, changes: [] })).toEqual(doseSlotsBetween(input));
  });

  it("is empty for a range that ends before it starts", () => {
    expect(between([med({ id: "a" })], [], "2026-11-19T00:00:00Z", "2026-11-18T00:00:00Z")).toEqual([]);
  });
});

describe("a dose answers only its own slot on its own day", () => {
  const MORNING = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d3001";
  const only = (time: string) => med({ id: "a", schedule: { type: "scheduled", slots: [{ time }] } });
  const inMorning = med({ id: "a", schedule: { type: "scheduled", slots: [{ passId: MORNING }] } });
  const passDose = (occurredAt: string): DueDose => ({
    id: `d${++doseId}`,
    occurredAt,
    details: { medicationId: "a", status: "given", scheduledFor: "08:00", passId: MORNING },
  });
  const given = (occurredAt: string, time: string) => dose("a", occurredAt, "given", time);
  const line = (s: { day: string; time: string; state: string }) => `${s.day} ${s.time} ${s.state}`;
  const range = (m: DueMedication, doses: DueDose[], from: string, to: string) =>
    doseSlotsBetween({ medications: [m], doses, from, to, timeZone: LA });

  it("two Given doses for one slot leave tomorrow's open; the earlier holds the slot", () => {
    const first = passDose("2026-11-18T16:05:00.000Z");
    const second = passDose("2026-11-18T16:20:00.000Z");
    const result = dueDoses({
      medications: [inMorning],
      passes: [{ id: MORNING, time: "08:00" }],
      doses: [second, first],
      now: new Date("2026-11-19T16:10:00Z"), // 8:10 the next day
      timeZone: LA,
    });
    expect(result.yesterday.map((s) => [s.state, s.dose?.id])).toEqual([["given", first.id]]);
    expect(states(result)).toEqual(["08:00 due"]);
  });

  it("a 20:00 dose given at 07:00 answers today's slot, and yesterday's stays missed", () => {
    const result = run([only("20:00")], [given("2026-11-19T15:00:00Z", "20:00")], plus(AM, -50));
    expect(states(result)).toEqual(["20:00 given"]);
    expect(result.missed.map((s) => s.day)).toEqual(["2026-11-18"]);
  });

  it("a 23:30 dose at 00:10 answers last night while open, and nothing once last night is answered", () => {
    const now = new Date("2026-11-19T08:20:00Z"); // 0:20 on the 19th
    const late = "2026-11-19T08:10:00Z"; // 0:10
    const open = run([only("23:30")], [given(late, "23:30")], now);
    expect(open.yesterday.map((s) => s.state)).toEqual(["given"]);
    expect(states(open)).toEqual(["23:30 upcoming"]);

    const answered = run(
      [only("23:30")],
      [given("2026-11-19T07:40:00Z", "23:30"), given(late, "23:30")], // 23:40, then 0:10
      now,
    );
    expect(answered.yesterday.map((s) => [s.state, s.dose?.occurredAt])).toEqual([
      ["given", "2026-11-19T07:40:00Z"],
    ]);
    expect(states(answered)).toEqual(["23:30 upcoming"]);
  });

  it("a dose past midnight answers the night before, not the day shown as yesterday", () => {
    // 0:10 on the 18th answers the 17th's 23:30, which is off the screen.
    const result = run(
      [only("23:30")],
      [given("2026-11-18T08:10:00Z", "23:30")],
      new Date("2026-11-19T20:00:00Z"),
    );
    expect(result.missed.map((s) => s.day)).toEqual(["2026-11-18"]);
  });

  it("a dose just before midnight answers tomorrow's early slot, not today's", () => {
    const result = run(
      [only("00:30")],
      [given("2026-11-20T07:50:00Z", "00:30")], // 23:50 on the 19th
      new Date("2026-11-20T07:55:00Z"),
    );
    expect(states(result)).toEqual(["00:30 overdue"]);
  });

  it("an unnamed dose near midnight still answers the nearest open slot across the day line", () => {
    const result = run(
      [only("23:30")],
      [dose("a", "2026-11-19T08:10:00Z")],
      new Date("2026-11-19T08:20:00Z"),
    );
    expect(result.yesterday.map((s) => s.state)).toEqual(["given"]);
    expect(states(result)).toEqual(["23:30 upcoming"]);
  });

  it("keeps a dose in a pass moved by more than the window", () => {
    const result = dueDoses({
      medications: [inMorning],
      passes: [{ id: MORNING, time: "12:00" }],
      doses: [passDose(plus(AM, 5).toISOString())],
      now: plus(AM, 250), // 12:10
      timeZone: LA,
    });
    expect(states(result)).toEqual(["12:00 given"]);
    expect(result.missed.map((s) => s.day)).toEqual(["2026-11-18"]);
  });

  it("holds on the spring-forward day", () => {
    // 07:00 PDT on Mar 8; yesterday's 20:00 was PST, today's is PDT.
    const result = run(
      [only("20:00")],
      [given("2026-03-08T14:00:00Z", "20:00")],
      new Date("2026-03-08T14:10:00Z"),
    );
    expect(result.slots.map((s) => [s.at, s.state])).toEqual([["2026-03-09T03:00:00.000Z", "given"]]);
    expect(result.missed.map((s) => s.at)).toEqual(["2026-03-08T04:00:00.000Z"]);
  });

  it("closes the same leaks over a range, and missedDoseCounts counts the real miss", () => {
    const doubled = range(
      only("08:00"),
      [given("2026-11-17T16:05:00Z", "08:00"), given("2026-11-17T16:20:00Z", "08:00")],
      "2026-11-17T08:00:00Z",
      "2026-11-19T08:00:00Z", // the end of the 18th
    );
    expect(doubled.map(line)).toEqual(["2026-11-17 08:00 given", "2026-11-18 08:00 missed"]);
    expect(missedDoseCounts(doubled)).toMatchObject([{ missed: 1, slots: 2 }]);

    const early = range(
      only("20:00"),
      [given("2026-11-18T15:00:00Z", "20:00")], // 07:00 on the 18th
      "2026-11-17T08:00:00Z",
      "2026-11-19T08:00:00Z",
    );
    expect(early.map(line)).toEqual(["2026-11-17 20:00 missed", "2026-11-18 20:00 given"]);

    const lateNight = range(
      only("23:30"),
      [given("2026-11-18T08:10:00Z", "23:30")], // 0:10 on the 18th
      "2026-11-17T08:00:00Z",
      "2026-11-19T08:00:00Z",
    );
    expect(lateNight.map(line)).toEqual(["2026-11-17 23:30 given", "2026-11-18 23:30 missed"]);

    const lateNightTwice = range(
      only("23:30"),
      [given("2026-11-18T07:40:00Z", "23:30"), given("2026-11-18T08:10:00Z", "23:30")], // 23:40, then 0:10
      "2026-11-17T08:00:00Z",
      "2026-11-19T08:00:00Z",
    );
    expect(lateNightTwice.map(line)).toEqual(["2026-11-17 23:30 given", "2026-11-18 23:30 missed"]);
    expect(missedDoseCounts(lateNightTwice)).toMatchObject([{ missed: 1, slots: 2 }]);
  });

  it("a dose answering a slot just before the range doesn't answer one inside it", () => {
    const slots = range(
      only("23:30"),
      [given("2026-11-18T08:10:00Z", "23:30")], // 0:10 on the 18th, for the 17th's 23:30
      "2026-11-18T08:00:00Z", // the 18th begins
      "2026-11-19T08:00:00Z",
    );
    expect(slots.map(line)).toEqual(["2026-11-18 23:30 missed"]);
  });

  describe("doseWarnings agrees with the matching", () => {
    const warned = (
      due: ReturnType<typeof dueDoses>,
      planned: Parameters<typeof doseWarnings>[1],
      now: Date,
    ) => doseWarnings(due, planned, now).some((w) => w.type === "alreadyGiven");

    it("for a time: warns only when the dose would answer nothing because its slot is given", () => {
      const now = new Date("2026-11-19T15:00:00Z"); // 07:00
      const planned = { medicationId: "a", status: "given" as const, scheduledFor: "20:00" };
      // Yesterday's 20:00 given, today's open: an early dose answers today's.
      const yesterdayGiven = run([only("20:00")], [given("2026-11-19T04:05:00Z", "20:00")], now);
      expect(warned(yesterdayGiven, planned, now)).toBe(false);
      // Today's already given early: the next would answer nothing.
      const todayGiven = run([only("20:00")], [given("2026-11-19T14:50:00Z", "20:00")], now);
      expect(warned(todayGiven, planned, now)).toBe(true);
      // A skipped slot blocks the dose but isn't a double dose.
      const skipped = run([only("20:00")], [dose("a", "2026-11-19T14:50:00Z", "skipped", "20:00")], now);
      expect(warned(skipped, planned, now)).toBe(false);
    });

    it("for a late-night slot: none while last night's is open, alreadyGiven once it's answered", () => {
      const now = new Date("2026-11-19T08:20:00Z"); // 0:20
      const planned = { medicationId: "a", status: "given" as const, scheduledFor: "23:30" };
      expect(warned(run([only("23:30")], [], now), planned, now)).toBe(false);
      const answered = run([only("23:30")], [given("2026-11-19T07:40:00Z", "23:30")], now);
      expect(doseWarnings(answered, planned, now)).toEqual([
        { type: "alreadyGiven", time: "23:30", givenAt: "2026-11-19T07:40:00Z" },
      ]);
    });

    it("for a pass: warns on the second dose, not on the next day's first", () => {
      const passes = [{ id: MORNING, time: "08:00" }];
      const planned = { medicationId: "a", status: "given" as const, passId: MORNING, scheduledFor: "08:00" };
      const at = (doses: DueDose[], now: Date) =>
        warned(dueDoses({ medications: [inMorning], passes, doses, now, timeZone: LA }), planned, now);
      const yesterday = passDose("2026-11-18T16:05:00.000Z");
      expect(at([yesterday], plus(AM, 10))).toBe(false);
      expect(at([yesterday, passDose(plus(AM, 5).toISOString())], plus(AM, 10))).toBe(true);
    });
  });
});

describe("dueDoses reads each day through the schedule history", () => {
  const PASS = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d5001";
  const timed = (...times: string[]) => ({
    type: "scheduled" as const,
    slots: times.map((time) => ({ time })),
  });
  const started = (medicationId: string, occurredAt: string) => ({
    id: `started-${medicationId}`,
    occurredAt,
    details: { medicationId, change: "started" },
  });
  const edited = (medicationId: string, occurredAt: string, before: string[], after: string[]) => ({
    id: `edited-${occurredAt}`,
    occurredAt,
    details: {
      medicationId,
      change: "changed",
      fields: ["schedule"],
      before: { schedule: timed(...before) },
      after: { schedule: timed(...after) },
    },
  });

  it("a medication added at 15:00 has no 08:00 slot today, and its 20:00 is upcoming", () => {
    const m = med({ id: "a", createdAt: "2026-11-19T23:00:00.000Z" });
    const result = dueDoses({
      medications: [m],
      doses: [],
      changes: [started("a", "2026-11-19T23:00:00.000Z")],
      now: new Date("2026-11-19T23:30:00.000Z"),
      timeZone: LA,
    });
    expect(states(result)).toEqual(["20:00 upcoming"]);
  });

  it("a slot added today for a time already past isn't shown, and is tomorrow", () => {
    const m = med({ id: "a" });
    const changes = [edited("a", "2026-11-19T23:00:00.000Z", ["20:00"], ["08:00", "20:00"])];
    const today = dueDoses({
      medications: [m],
      doses: [],
      changes,
      now: new Date("2026-11-19T23:30:00.000Z"),
      timeZone: LA,
    });
    expect(states(today)).toEqual(["20:00 upcoming"]);
    const tomorrow = dueDoses({
      medications: [m],
      doses: [],
      changes,
      now: new Date("2026-11-20T16:10:00.000Z"),
      timeZone: LA,
    });
    expect(states(tomorrow)).toEqual(["08:00 due", "20:00 upcoming"]);
  });

  it("yesterday's missed list ignores a slot added today", () => {
    const result = dueDoses({
      medications: [med({ id: "a" })],
      doses: [],
      changes: [edited("a", "2026-11-20T18:00:00.000Z", ["20:00"], ["08:00", "20:00"])],
      now: new Date("2026-11-20T19:00:00.000Z"),
      timeZone: LA,
    });
    expect(result.missed.map((s) => s.time)).toEqual(["20:00"]);
  });

  it("a pass moved today shows one slot, at the new time, still answered by the dose before the move", () => {
    const m = med({ id: "a", schedule: { type: "scheduled", slots: [{ passId: PASS }] } });
    const given: DueDose = {
      id: "before-move",
      occurredAt: "2026-11-19T16:05:00.000Z",
      details: { medicationId: "a", status: "given", scheduledFor: "08:00", passId: PASS },
    };
    const result = dueDoses({
      medications: [m],
      passes: [{ id: PASS, time: "11:00" }],
      doses: [given],
      changes: [
        {
          id: "moved",
          occurredAt: "2026-11-19T18:00:00.000Z",
          details: {
            change: "passMoved",
            passId: PASS,
            passName: "Morning",
            beforeTime: "08:00",
            afterTime: "11:00",
            medicationIds: ["a"],
          },
        },
      ],
      now: new Date("2026-11-19T19:30:00.000Z"),
      timeZone: LA,
    });
    expect(states(result)).toEqual(["11:00 given"]);
    expect(result.slots[0]?.dose?.id).toBe("before-move");
  });

  it("without entries about a medication, the result is the old one", () => {
    const input = {
      medications: [med({ id: "a" })],
      doses: [dose("a", AM, "given", "08:00")],
      now: plus(AM, 90),
      timeZone: LA,
    };
    const other = [started("someone-else", "2026-11-19T15:00:00.000Z")];
    expect(dueDoses({ ...input, changes: other })).toEqual(dueDoses(input));
  });

  describe("a schedule change across midnight (B-611)", () => {
    const change = edited("a", "2026-11-20T08:05:00.000Z", ["23:30"], ["00:30"]);
    const range = {
      from: "2026-11-19T20:00:00.000Z",
      to: "2026-11-20T14:00:00.000Z",
      timeZone: LA,
    };

    it("a 23:30 dose given at 00:10 answers last night, and today's 00:30 stays open", () => {
      const slots = doseSlotsBetween({
        ...range,
        medications: [med({ id: "a", schedule: timed("00:30") })],
        doses: [dose("a", "2026-11-20T08:10:00.000Z", "given", "23:30")],
        changes: [change],
      });
      expect(slots.map((s) => `${s.day} ${s.time} ${s.state}`)).toEqual([
        "2026-11-19 23:30 given",
        "2026-11-20 00:30 overdue",
      ]);
    });

    it("the same through a moved pass, from a device that hadn't seen the move", () => {
      const slots = doseSlotsBetween({
        ...range,
        medications: [med({ id: "a", schedule: { type: "scheduled", slots: [{ passId: PASS }] } })],
        passes: [{ id: PASS, time: "00:30" }],
        doses: [
          {
            id: "stale",
            occurredAt: "2026-11-20T08:10:00.000Z",
            details: { medicationId: "a", status: "given", scheduledFor: "23:30", passId: PASS },
          },
        ],
        changes: [
          {
            id: "moved",
            occurredAt: "2026-11-20T08:05:00.000Z",
            details: {
              change: "passMoved",
              passId: PASS,
              passName: "Night",
              beforeTime: "23:30",
              afterTime: "00:30",
              medicationIds: ["a"],
            },
          },
        ],
      });
      expect(slots.map((s) => `${s.day} ${s.time} ${s.state}`)).toEqual([
        "2026-11-19 23:30 given",
        "2026-11-20 00:30 overdue",
      ]);
    });

    it("on Today too: last night isn't missed", () => {
      const result = dueDoses({
        medications: [med({ id: "a", schedule: timed("00:30") })],
        doses: [dose("a", "2026-11-20T08:10:00.000Z", "given", "23:30")],
        changes: [change],
        now: new Date("2026-11-20T14:00:00.000Z"),
        timeZone: LA,
      });
      expect(result.missed).toEqual([]);
      expect(states(result)).toEqual(["00:30 overdue"]);
    });
  });
});
