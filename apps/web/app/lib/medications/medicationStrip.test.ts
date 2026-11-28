import { describe, expect, it } from "vitest";
import { medCountText, medicationStrip, medicationStripText } from "./medicationStrip";
import type { DueDose, DueMedication } from "@caretook/data/schema";
import { dueDoses, duePasses } from "@caretook/data/schema";

const LA = "America/Los_Angeles";
const MORNING = "11111111-1111-4111-8111-111111111111";
const EVENING = "22222222-2222-4222-8222-222222222222";
const PASSES = [
  { id: MORNING, name: "Morning", time: "08:00", sortOrder: 0 },
  { id: EVENING, name: "Evening", time: "20:00", sortOrder: 1 },
];

const med = (id: string, slots: ({ passId: string } | { time: string })[], name = id): DueMedication => ({
  id,
  name,
  strength: name === "Metformin" ? "500 mg" : null,
  dose: "1 tablet",
  schedule: { type: "scheduled", slots },
  status: "current",
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
});

// 8:00 in Los Angeles on 2026-11-19 is 16:00Z.
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(2026, 10, 19, h! + 8, m));
};
let n = 0;
const given = (medicationId: string, hhmm: string, passId: string | null): DueDose => ({
  id: `d${++n}`,
  occurredAt: at(hhmm).toISOString(),
  details: { medicationId, status: "given", scheduledFor: null, passId },
  createdBy: "ann",
});

const MEDS = [
  med("a", [{ passId: MORNING }, { passId: EVENING }]),
  med("b", [{ passId: MORNING }, { passId: EVENING }]),
  med("c", [{ passId: EVENING }]),
  med("m", [{ time: "14:00" }], "Metformin"),
];

const stripAt = (now: string, doses: DueDose[] = [], medications = MEDS) =>
  medicationStrip(
    duePasses(dueDoses({ medications, passes: PASSES, doses, now: at(now), timeZone: LA }), PASSES),
  );
const textAt = (now: string, doses: DueDose[] = [], medications = MEDS) => {
  const strip = stripAt(now, doses, medications);
  return strip ? medicationStripText(strip).text : null;
};

describe("medicationStrip", () => {
  it("is hidden without scheduled medications", () => {
    expect(stripAt("09:00", [], [])).toBeNull();
    const asNeeded = { ...med("p", []), schedule: { type: "asNeeded" } } as DueMedication;
    expect(stripAt("09:00", [], [asNeeded])).toBeNull();
  });

  it("shows the next pass, quietly, before anything is due", () => {
    expect(stripAt("07:00")).toMatchObject({ state: "next", tomorrow: false, pass: { passId: MORNING } });
    expect(textAt("07:00")).toBe("Next: Morning · 8:00 · 2 meds");
  });

  it("turns due at the pass's time, then overdue an hour later", () => {
    expect(stripAt("08:00")?.state).toBe("due");
    expect(textAt("08:30")).toBe("Due: Morning · 8:00 · 2 meds");
    expect(stripAt("09:00")?.state).toBe("overdue");
    expect(textAt("09:30")).toBe("Overdue: Morning · 8:00 · 2 meds");
  });

  it("says how many are left once some are logged", () => {
    expect(textAt("08:30", [given("a", "08:10", MORNING)])).toBe("Due: Morning · 8:00 · 1 med left");
  });

  it("moves to the next pass once a pass is done", () => {
    const done = [given("a", "08:10", MORNING), given("b", "08:10", MORNING)];
    expect(textAt("08:30", done)).toBe("Next: Metformin 500 mg · 14:00");
    expect(textAt("15:30", [...done, given("m", "14:05", null)])).toBe("Next: Evening · 20:00 · 3 meds");
  });

  it("lets an overdue earlier pass take the line's place over a due one", () => {
    const strip = stripAt("14:10");
    expect(strip).toMatchObject({ state: "overdue", more: 1, pass: { passId: MORNING } });
    expect(medicationStripText(strip!).text).toBe("Overdue: Morning · 8:00 · 2 meds · +1 more");
  });

  it("shows tomorrow's first pass once today's are all done", () => {
    const all = [
      given("a", "08:05", MORNING),
      given("b", "08:05", MORNING),
      given("m", "14:05", null),
      given("a", "20:05", EVENING),
      given("b", "20:05", EVENING),
      given("c", "20:05", EVENING),
    ];
    expect(stripAt("21:00", all)).toMatchObject({ state: "next", tomorrow: true, pass: { passId: MORNING } });
    expect(textAt("21:00", all)).toBe("Next: Morning · tomorrow 8:00 · 2 meds");
  });

  it("splits the words for the link", () => {
    expect(medicationStripText(stripAt("07:00")!)).toMatchObject({
      lead: "Next",
      title: "Morning",
      rest: "8:00 · 2 meds",
    });
  });
});

describe("medCountText", () => {
  it("counts", () => {
    expect(medCountText(1)).toBe("1 med");
    expect(medCountText(4)).toBe("4 meds");
  });
});
