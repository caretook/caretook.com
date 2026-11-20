import type { DueDose, DueMedication } from "./dueDoses";

import { describe, expect, it } from "vitest";
import { dueDoses } from "./dueDoses";
import { duePasses, givenAllWrites, isNamedPass, isPassDueNow, passLogIdFor } from "./duePasses";

const LA = "America/Los_Angeles";
const MORNING = "11111111-1111-4111-8111-111111111111";
const EVENING = "22222222-2222-4222-8222-222222222222";
const LOG = "33333333-3333-4333-8333-333333333333";
const PASSES = [
  { id: MORNING, name: "Morning", time: "08:00", sortOrder: 0 },
  { id: EVENING, name: "Evening", time: "20:00", sortOrder: 1 },
];

const med = (
  id: string,
  slots: DueMedication["schedule"],
  over: Partial<DueMedication> = {},
): DueMedication => ({
  id,
  name: id,
  strength: null,
  dose: "1 tablet",
  schedule: slots,
  status: "current",
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});
const inPasses = (...slots: ({ passId: string; amount?: string } | { time: string; amount?: string })[]) =>
  ({ type: "scheduled", slots }) as DueMedication["schedule"];

let n = 0;
const dose = (
  medicationId: string,
  occurredAt: string,
  over: Partial<DueDose["details"]> = {},
  createdBy = "ann",
): DueDose => ({
  id: `d${++n}`,
  occurredAt,
  details: { medicationId, status: "given", scheduledFor: null, ...over },
  createdBy,
});

// 8:00 in Los Angeles on 2026-11-19 is 16:00Z.
const at = (hhmm: string, day = "2026-11-19") => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(
    Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8)), h! + 8, m),
  );
};

const MEDS = [
  med("a", inPasses({ passId: MORNING, amount: "1000 mg" }, { passId: EVENING })),
  med("b", inPasses({ passId: MORNING })),
  med("c", inPasses({ passId: MORNING }, { time: "14:00" })),
];

const passesAt = (now: Date, doses: DueDose[] = [], medications = MEDS) =>
  duePasses(dueDoses({ medications, passes: PASSES, doses, now, timeZone: LA }), PASSES);

const summary = (list: ReturnType<typeof duePasses>) =>
  list.map(
    (p) =>
      `${p.name ?? p.key} ${p.time} ${p.state}${p.partly ? " partly" : ""} ${p.open.length}/${p.slots.length}`,
  );

describe("duePasses", () => {
  it("rolls slots up into passes, a time of its own being a pass of one, in time order", () => {
    expect(summary(passesAt(at("07:00")))).toEqual([
      "Morning 08:00 upcoming 3/3",
      "c@14:00 14:00 upcoming 1/1",
      "Evening 20:00 upcoming 1/1",
    ]);
    const [morning, own] = passesAt(at("07:00"));
    expect(isNamedPass(morning!)).toBe(true);
    expect(isNamedPass(own!)).toBe(false);
    expect(own!.passId).toBeNull();
    expect(morning!.slots.map((s) => [s.medication.id, s.amount])).toEqual([
      ["a", "1000 mg"],
      ["b", "1 tablet"],
      ["c", "1 tablet"],
    ]);
  });

  it("is due, then overdue, by its open slots", () => {
    expect(summary(passesAt(at("08:10"))).at(0)).toBe("Morning 08:00 due 3/3");
    expect(summary(passesAt(at("09:30"))).at(0)).toBe("Morning 08:00 overdue 3/3");
    expect(isPassDueNow(passesAt(at("09:30"))[0]!)).toBe(true);
    expect(isPassDueNow(passesAt(at("07:30"))[0]!)).toBe(false);
  });

  it("is partly done while some are answered, with who logged them, and done once all are", () => {
    const doses = [
      dose("b", at("08:05").toISOString(), { passId: MORNING, scheduledFor: "08:00" }, "ann"),
      dose("c", at("08:06").toISOString(), { passId: MORNING, status: "refused", passLogId: LOG }, "bo"),
    ];
    const [morning] = passesAt(at("09:30"), doses);
    expect(summary([morning!])).toEqual(["Morning 08:00 overdue partly 1/3"]);
    expect(morning!.open.map((s) => s.medication.id)).toEqual(["a"]);
    expect(morning!.loggedBy).toEqual([
      { userId: "ann", count: 1 },
      { userId: "bo", count: 1 },
    ]);
    expect(morning!.passLogId).toBe(LOG);

    const all = [...doses, dose("a", at("09:31").toISOString(), { passId: MORNING }, "ann")];
    const [done] = passesAt(at("09:35"), all);
    expect(summary([done!])).toEqual(["Morning 08:00 done 0/3"]);
    expect(isPassDueNow(done!)).toBe(false);
    expect(done!.loggedBy).toEqual([
      { userId: "ann", count: 2 },
      { userId: "bo", count: 1 },
    ]);
  });

  it("keeps a retimed pass's answered doses", () => {
    const doses = [dose("a", at("08:02").toISOString(), { passId: MORNING, scheduledFor: "08:00" })];
    const moved = [{ ...PASSES[0]!, time: "08:30" }, PASSES[1]!];
    const due = dueDoses({ medications: MEDS, passes: moved, doses, now: at("08:40"), timeZone: LA });
    const [morning] = duePasses(due, moved);
    expect(morning!.time).toBe("08:30");
    expect(morning!.open.map((s) => s.medication.id)).toEqual(["b", "c"]);
    expect(morning!.partly).toBe(true);
  });

  it("leaves yesterday's missed slots out of today's passes", () => {
    // Nothing logged yesterday: today's Morning is still only today's three.
    const list = passesAt(at("08:10"));
    expect(list.every((p) => p.slots.every((s) => s.day === "2026-11-19"))).toBe(true);
    const due = dueDoses({ medications: MEDS, passes: PASSES, doses: [], now: at("08:10"), timeZone: LA });
    expect(due.missed.length).toBe(5);
  });

  it("puts a named pass before a time of its own at the same moment, and passes in their order", () => {
    const noon = { id: "44444444-4444-4444-8444-444444444444", name: "Noon", time: "08:00", sortOrder: 2 };
    const passes = [...PASSES, noon];
    const medications = [
      med("x", inPasses({ time: "08:00" })),
      med("y", inPasses({ passId: noon.id })),
      med("z", inPasses({ passId: MORNING })),
    ];
    const due = dueDoses({ medications, passes, doses: [], now: at("07:00"), timeZone: LA });
    expect(duePasses(due, passes).map((p) => p.name ?? p.key)).toEqual(["Morning", "Noon", "x@08:00"]);
  });
});

describe("givenAllWrites", () => {
  const ids = () => {
    let i = 0;
    return () => `00000000-0000-4000-8000-00000000000${++i}`;
  };

  it("writes a given dose now for every open slot, with its amount, time, pass and one new round", () => {
    const [morning] = passesAt(at("08:10"));
    const now = at("08:10");
    expect(givenAllWrites(morning!, now, ids())).toEqual(
      ["a", "b", "c"].map((id) => ({
        medicationId: id,
        status: "given",
        amount: id === "a" ? "1000 mg" : "1 tablet",
        scheduledFor: "08:00",
        passId: MORNING,
        passLogId: "00000000-0000-4000-8000-000000000001",
        occurredAt: now.toISOString(),
      })),
    );
  });

  it("skips what's answered and joins the round already started", () => {
    const doses = [
      dose("b", at("08:05").toISOString(), { passId: MORNING, status: "skipped", passLogId: LOG }),
      dose("c", at("08:06").toISOString(), { passId: MORNING, scheduledFor: "08:00" }),
    ];
    const [morning] = passesAt(at("09:20"), doses);
    const writes = givenAllWrites(morning!, at("09:20"), ids());
    expect(writes.map((w) => [w.medicationId, w.passLogId])).toEqual([["a", LOG]]);
  });

  it("writes nothing for a pass that's done", () => {
    const doses = ["a", "b", "c"].map((id) => dose(id, at("08:05").toISOString(), { passId: MORNING }));
    const [morning] = passesAt(at("08:10"), doses);
    expect(givenAllWrites(morning!, at("08:10"), ids())).toEqual([]);
  });

  it("logs a time of its own as a pass of one, with no pass", () => {
    const own = passesAt(at("14:05")).find((p) => !p.passId)!;
    expect(givenAllWrites(own, at("14:05"), ids())).toEqual([
      {
        medicationId: "c",
        status: "given",
        amount: "1 tablet",
        scheduledFor: "14:00",
        passId: null,
        passLogId: "00000000-0000-4000-8000-000000000001",
        occurredAt: at("14:05").toISOString(),
      },
    ]);
  });

  it("an overdue pass is logged too", () => {
    const [morning] = passesAt(at("11:00"));
    expect(morning!.state).toBe("overdue");
    expect(givenAllWrites(morning!, at("11:00"), ids())).toHaveLength(3);
  });

  it("passLogIdFor reuses the pass's round, else makes one", () => {
    expect(passLogIdFor({ passLogId: LOG }, () => "new")).toBe(LOG);
    expect(passLogIdFor({ passLogId: null }, () => "new")).toBe("new");
  });
});
