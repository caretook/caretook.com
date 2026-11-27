import type { DueDose, DueMedication } from "./dueDoses";

import { describe, expect, it } from "vitest";
import { doseRecord } from "./doseRecord";
import { dueDoses } from "./dueDoses";
import { duePasses } from "./duePasses";

// The past days' rounds with their states, on the due-dose tests' fixtures:
// Morning and Evening passes in Los Angeles (PST in November), medications
// added long before the days read. All data is fictional.

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

let doseId = 0;
const dose = (
  medicationId: string,
  occurredAt: string,
  status: DueDose["details"]["status"],
  name: { passId?: string; scheduledFor?: string } = {},
): DueDose => ({
  id: `d${++doseId}`,
  occurredAt,
  details: { medicationId, status, scheduledFor: name.scheduledFor ?? null, passId: name.passId ?? null },
  createdBy: "user-sam",
});

// 12:00 in Los Angeles on Friday 2026-11-20.
const NOW = new Date("2026-11-20T20:00:00.000Z");

const record = (
  medications: DueMedication[],
  doses: DueDose[],
  from: string,
  days: number,
  now = NOW,
  changes: { id: string; occurredAt: string; details: unknown }[] = [],
) => doseRecord({ medications, passes: PASSES, doses, changes, from, days, now, timeZone: LA });

/** Each day's rounds as "HH:MM name: med state, …". */
const shape = (result: ReturnType<typeof doseRecord>) =>
  result.days.map((d) => ({
    day: d.day,
    rounds: d.rounds.map(
      (r) => `${r.time} ${r.name ?? "-"}: ${r.slots.map((s) => `${s.medication.id} ${s.state}`).join(", ")}`,
    ),
  }));

describe("doseRecord", () => {
  it("gives past days' given, skipped and unanswered slots as given, skipped and missed; today's by the clock", () => {
    const aspirin = med("aspirin", slots({ passId: MORNING }, { passId: EVENING }));
    const doses = [
      // 08:05, 08:10 and 20:02 on the days they answer.
      dose("aspirin", "2026-11-17T16:05:00.000Z", "given", { passId: MORNING, scheduledFor: "08:00" }),
      dose("aspirin", "2026-11-18T04:02:00.000Z", "given", { passId: EVENING, scheduledFor: "20:00" }),
      dose("aspirin", "2026-11-18T16:10:00.000Z", "skipped", { passId: MORNING, scheduledFor: "08:00" }),
    ];
    const result = record([aspirin], doses, "2026-11-17", 4);
    expect(shape(result)).toEqual([
      { day: "2026-11-17", rounds: ["08:00 Morning: aspirin given", "20:00 Evening: aspirin given"] },
      { day: "2026-11-18", rounds: ["08:00 Morning: aspirin skipped", "20:00 Evening: aspirin missed"] },
      { day: "2026-11-19", rounds: ["08:00 Morning: aspirin missed", "20:00 Evening: aspirin missed"] },
      // Today at 12:00: the morning's open slot is overdue, the evening's still upcoming.
      { day: "2026-11-20", rounds: ["08:00 Morning: aspirin overdue", "20:00 Evening: aspirin upcoming"] },
    ]);
    const given = result.days[0]!.rounds[0]!.slots[0]!;
    expect(given.dose).toMatchObject({ id: doses[0]!.id, createdBy: "user-sam" });
    expect(given.amount).toBe("1 tablet");
    expect(result.days[2]!.rounds[0]!.slots[0]!.dose).toBeNull();
  });

  it("has a slot just before now due, not missed", () => {
    const result = record(
      [med("aspirin", slots({ passId: MORNING }))],
      [],
      "2026-11-20",
      1,
      new Date("2026-11-20T16:30:00.000Z"),
    );
    expect(shape(result)).toEqual([{ day: "2026-11-20", rounds: ["08:00 Morning: aspirin due"] }]);
  });

  it("counts a medication discontinued on day 2 on day 1 only", () => {
    const stopped = med("stopped", slots({ passId: MORNING }), {
      status: "discontinued",
      stoppedOn: "2026-11-18",
    });
    expect(shape(record([stopped], [], "2026-11-17", 3))).toEqual([
      { day: "2026-11-17", rounds: ["08:00 Morning: stopped missed"] },
      { day: "2026-11-18", rounds: [] },
      { day: "2026-11-19", rounds: [] },
    ]);
  });

  it("gives each day the schedule it had: a slot moved on day 2 is at the old time on day 1", () => {
    const timed = (time: string) => ({ type: "scheduled" as const, slots: [{ time }] });
    // Moved from 08:00 to 09:00 at 06:00 on 2026-11-18.
    const changes = [
      {
        id: "moved",
        occurredAt: "2026-11-18T14:00:00.000Z",
        details: {
          medicationId: "a",
          change: "changed",
          fields: ["schedule"],
          before: { schedule: timed("08:00") },
          after: { schedule: timed("09:00") },
        },
      },
    ];
    const result = record([med("a", timed("09:00"))], [], "2026-11-17", 2, NOW, changes);
    expect(shape(result)).toEqual([
      { day: "2026-11-17", rounds: ["08:00 -: a missed"] },
      { day: "2026-11-18", rounds: ["09:00 -: a missed"] },
    ]);
  });

  it("groups a day as duePasses does: a pass's slots one round, a medication's own time its own", () => {
    const medications = [
      med("metformin", slots({ passId: MORNING, amount: "500 mg" }, { passId: EVENING })),
      med("aspirin", slots({ passId: MORNING })),
      med("vitamin", slots({ time: "13:00" })),
      med("night", slots({ time: "20:00" })),
    ];
    const result = record(medications, [], "2026-11-19", 1);
    expect(shape(result)[0]!.rounds).toEqual([
      "08:00 Morning: aspirin missed, metformin missed",
      "13:00 -: vitamin missed",
      "20:00 Evening: metformin missed",
      "20:00 -: night missed",
    ]);
    expect(result.days[0]!.rounds[0]!.slots.map((s) => s.amount)).toEqual(["1 tablet", "500 mg"]);
    // The rounds Today showed that day, in its order.
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
    expect(result.days[0]!.rounds.map((r) => [r.passId, r.name, r.time])).toEqual(
      today.map((p) => [p.passId, p.name, p.time]),
    );
    expect(result.days[0]!.rounds.map((r) => r.slots.map((s) => s.medication.id))).toEqual(
      today.map((p) => p.slots.map((s) => s.medication.id)),
    );
  });

  it("keeps a 00:00 slot on its own day and leaves out as-needed medications", () => {
    const result = record(
      [med("night", slots({ time: "00:00" })), med("pain", { type: "asNeeded", maxPerDay: 3 })],
      [],
      "2026-11-18",
      2,
    );
    expect(shape(result)).toEqual([
      { day: "2026-11-18", rounds: ["00:00 -: night missed"] },
      { day: "2026-11-19", rounds: ["00:00 -: night missed"] },
    ]);
  });

  it("keeps wall-clock times across a DST change", () => {
    const result = record(
      [med("aspirin", slots({ passId: MORNING }))],
      [],
      "2026-10-31",
      3,
      new Date("2026-11-03T20:00:00.000Z"),
    );
    expect(
      result.days.map((d) => [
        d.day,
        d.rounds[0]!.time,
        d.rounds[0]!.slots[0]!.at,
        d.rounds[0]!.slots[0]!.state,
      ]),
    ).toEqual([
      ["2026-10-31", "08:00", "2026-10-31T15:00:00.000Z", "missed"],
      ["2026-11-01", "08:00", "2026-11-01T16:00:00.000Z", "missed"],
      ["2026-11-02", "08:00", "2026-11-02T16:00:00.000Z", "missed"],
    ]);
  });
});
