import type { DueMedication } from "./dueDoses";

import { describe, expect, it } from "vitest";
import { doseSchedule } from "./doseSchedule";
import { dueDoses } from "./dueDoses";
import { duePasses } from "./duePasses";

// The plan ahead, on the due-dose tests' fixtures: Morning and Evening passes
// in Los Angeles, medications added long before the days read.

const LA = "America/Los_Angeles";
const MORNING = "11111111-1111-4111-8111-111111111111";
const EVENING = "22222222-2222-4222-8222-222222222222";
const PASSES = [
  { id: MORNING, name: "Morning", time: "08:00", sortOrder: 0 },
  { id: EVENING, name: "Evening", time: "20:00", sortOrder: 1 },
];

const med = (
  id: string,
  schedule: DueMedication["schedule"],
  over: Partial<DueMedication> = {},
): DueMedication => ({
  id,
  name: id,
  strength: null,
  dose: "1 tablet",
  schedule,
  status: "current",
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});
const slots = (...s: ({ passId: string; amount?: string } | { time: string; amount?: string })[]) =>
  ({ type: "scheduled", slots: s }) as DueMedication["schedule"];

const plan = (medications: DueMedication[], from = "2026-11-19", days = 3, timeZone = LA) =>
  doseSchedule({ medications, passes: PASSES, from, days, timeZone });

/** Each day's rounds as "HH:MM name: meds". */
const shape = (result: ReturnType<typeof doseSchedule>) =>
  result.days.map((d) => ({
    day: d.day,
    rounds: d.rounds.map(
      (r) => `${r.time} ${r.name ?? "-"}: ${r.medications.map((m) => m.medication.id).join(", ")}`,
    ),
  }));

describe("doseSchedule", () => {
  it("gives each of the days asked for its rounds", () => {
    const result = plan([med("aspirin", slots({ passId: MORNING }, { passId: EVENING }))]);
    expect(shape(result)).toEqual(
      ["2026-11-19", "2026-11-20", "2026-11-21"].map((day) => ({
        day,
        rounds: ["08:00 Morning: aspirin", "20:00 Evening: aspirin"],
      })),
    );
    expect(result.days[0]!.rounds[0]).toMatchObject({
      passId: MORNING,
      at: "2026-11-19T16:00:00.000Z",
      medications: [{ amount: "1 tablet" }],
    });
  });

  it("groups a day as duePasses does: a pass's medications together, a time of its own alone, by time", () => {
    const medications = [
      med("metformin", slots({ passId: MORNING, amount: "500 mg" }, { passId: EVENING })),
      med("aspirin", slots({ passId: MORNING })),
      med("vitamin", slots({ time: "13:00" })),
    ];
    const result = plan(medications, "2026-11-19", 1);
    expect(shape(result)[0]!.rounds).toEqual([
      "08:00 Morning: aspirin, metformin",
      "13:00 -: vitamin",
      "20:00 Evening: metformin",
    ]);
    expect(result.days[0]!.rounds[0]!.medications.map((m) => m.amount)).toEqual(["1 tablet", "500 mg"]);
    // The same rounds Today shows for that day.
    const today = duePasses(
      dueDoses({
        medications,
        passes: PASSES,
        doses: [],
        now: new Date("2026-11-19T15:00:00Z"),
        timeZone: LA,
      }),
      PASSES,
    );
    expect(result.days[0]!.rounds.map((r) => [r.passId, r.name, r.time, r.at])).toEqual(
      today.map((p) => [p.passId, p.name, p.time, p.at]),
    );
    expect(result.days[0]!.rounds.map((r) => r.medications.map((m) => m.medication.id))).toEqual(
      today.map((p) => p.slots.map((s) => s.medication.id)),
    );
  });

  it("keeps a 00:00 slot on its own day only", () => {
    const result = plan([med("night", slots({ time: "00:00" }))], "2026-11-19", 2);
    expect(shape(result)).toEqual([
      { day: "2026-11-19", rounds: ["00:00 -: night"] },
      { day: "2026-11-20", rounds: ["00:00 -: night"] },
    ]);
    expect(result.days[1]!.rounds[0]!.at).toBe("2026-11-20T08:00:00.000Z");
  });

  it("lists a medication with a pass and its own time at the same moment once", () => {
    const result = plan([med("aspirin", slots({ passId: MORNING }, { time: "08:00" }))], "2026-11-19", 1);
    expect(shape(result)[0]!.rounds).toEqual(["08:00 Morning: aspirin"]);
  });

  it("starts a medication on the day it started, or was added", () => {
    const started = med("started", slots({ passId: MORNING }), { startedOn: "2026-11-20" });
    const added = med("added", slots({ passId: EVENING }), { createdAt: "2026-11-21T18:00:00.000Z" });
    expect(shape(plan([started, added]))).toEqual([
      { day: "2026-11-19", rounds: [] },
      { day: "2026-11-20", rounds: ["08:00 Morning: started"] },
      { day: "2026-11-21", rounds: ["08:00 Morning: started", "20:00 Evening: added"] },
    ]);
  });

  it("puts as-needed medications only in asNeeded, with their maximum", () => {
    const result = plan([
      med("pain", { type: "asNeeded", maxPerDay: 3 }),
      med("antacid", { type: "asNeeded" }),
      med("aspirin", slots({ passId: MORNING })),
    ]);
    expect(result.asNeeded.map((a) => [a.medication.id, a.max])).toEqual([
      ["antacid", null],
      ["pain", 3],
    ]);
    for (const day of result.days)
      expect(day.rounds.flatMap((r) => r.medications.map((m) => m.medication.id))).toEqual(["aspirin"]);
  });

  it("leaves out completed, discontinued and deleted medications", () => {
    const result = plan([
      med("done", slots({ passId: MORNING }), { status: "completed", stoppedOn: "2026-11-25" }),
      med("stopped", slots({ passId: MORNING }), { status: "discontinued", stoppedOn: "2026-11-25" }),
      med("gone", slots({ passId: MORNING }), { deletedAt: "2026-11-01T00:00:00.000Z" }),
      med("gonePrn", { type: "asNeeded", maxPerDay: 2 }, { deletedAt: "2026-11-01T00:00:00.000Z" }),
    ]);
    expect(result.days.flatMap((d) => d.rounds)).toEqual([]);
    expect(result.asNeeded).toEqual([]);
  });

  it("keeps wall-clock times across a DST change", () => {
    const result = plan([med("aspirin", slots({ passId: MORNING }))], "2026-10-31", 3);
    expect(result.days.map((d) => [d.day, d.rounds[0]!.time, d.rounds[0]!.at])).toEqual([
      ["2026-10-31", "08:00", "2026-10-31T15:00:00.000Z"],
      ["2026-11-01", "08:00", "2026-11-01T16:00:00.000Z"],
      ["2026-11-02", "08:00", "2026-11-02T16:00:00.000Z"],
    ]);
  });

  it("gives days with no rounds without medications", () => {
    const result = plan([], "2026-11-19", 2);
    expect(result).toEqual({
      days: [
        { day: "2026-11-19", rounds: [] },
        { day: "2026-11-20", rounds: [] },
      ],
      asNeeded: [],
    });
  });
});
