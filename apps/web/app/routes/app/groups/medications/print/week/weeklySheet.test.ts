import type { PrintMedicationInput, PrintRecipient } from "../printSheet";

import { DOSE_STATUSES } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import {
  AS_NEEDED_LINES,
  DOSE_MARKS,
  parseWeekStart,
  thisWeekStart,
  weekLabel,
  weeklySheet,
} from "./weeklySheet";

const ZONE = "America/Los_Angeles";
// 10:00 on Wednesday, Nov 18, 2026 in Los Angeles (18:00 UTC).
const NOW = new Date("2026-11-18T18:00:00Z");

const MORNING = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1001";
const EVENING = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1002";
const NOON = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1003";
const passes = [
  { id: EVENING, name: "Evening", time: "20:00", sortOrder: 2 },
  { id: MORNING, name: "Morning", time: "08:00", sortOrder: 0 },
  { id: NOON, name: "Lunch", time: "12:30", sortOrder: 1 },
];

const recipient: PrintRecipient = {
  name: "Patricia Example",
  preferredName: "Grandma Pat",
  dateOfBirth: "1941-03-14",
  timeZone: ZONE,
};

let n = 0;
const med = (patch: Partial<PrintMedicationInput> & { name: string }): PrintMedicationInput => ({
  id: `m${++n}`,
  strength: null,
  form: null,
  dose: null,
  directions: null,
  reason: null,
  schedule: { type: "asNeeded" },
  status: "current",
  startedOn: null,
  stoppedOn: null,
  stopReason: null,
  stopNote: null,
  prescriberId: null,
  pharmacyId: null,
  ...patch,
});

const sheet = (medications: PrintMedicationInput[], weekStart?: string | null, now = NOW) =>
  weeklySheet({ recipient, groupName: "Dev Family", medications, passes, weekStart, now, locale: "en-US" });

describe("the week", () => {
  it("starts on this week's Monday in the recipient's zone by default", () => {
    const s = sheet([]);
    expect(s.start).toBe("2026-11-16");
    expect(s.thisWeekStart).toBe("2026-11-16");
    expect(s.days.map((d) => `${d.weekday} ${d.date}`)).toEqual([
      "Mon Nov 16",
      "Tue Nov 17",
      "Wed Nov 18",
      "Thu Nov 19",
      "Fri Nov 20",
      "Sat Nov 21",
      "Sun Nov 22",
    ]);
    expect(s.label).toBe("Nov 16 – 22, 2026");
    expect([s.previousStart, s.nextStart]).toEqual(["2026-11-09", "2026-11-23"]);
  });

  it("takes the recipient's day, not UTC's: late Sunday there is still last week", () => {
    // 04:00 UTC on Monday, Nov 23 is 20:00 on Sunday, Nov 22 in Los Angeles.
    expect(thisWeekStart(new Date("2026-11-23T04:00:00Z"), ZONE)).toBe("2026-11-16");
    expect(thisWeekStart(new Date("2026-11-23T04:00:00Z"), "UTC")).toBe("2026-11-23");
  });

  it("starts on a chosen day, and ignores one that isn't a real day", () => {
    expect(sheet([], "2026-11-26").days.map((d) => d.weekday)).toEqual([
      "Thu",
      "Fri",
      "Sat",
      "Sun",
      "Mon",
      "Tue",
      "Wed",
    ]);
    expect(sheet([], "2026-02-30").start).toBe("2026-11-16");
    expect(sheet([], "next week").start).toBe("2026-11-16");
    expect(parseWeekStart("2026-11-23")).toBe("2026-11-23");
    expect(parseWeekStart("2026-13-01")).toBeNull();
    expect(parseWeekStart(null)).toBeNull();
  });

  it("has seven calendar days across a clock change in the recipient's zone", () => {
    // Clocks go back at 2:00 on Sunday, Nov 1, 2026 in Los Angeles; forward on Mar 8, 2026.
    const fall = sheet([], null, new Date("2026-11-01T09:30:00Z")); // 1:30 PST, after the change
    expect(fall.start).toBe("2026-10-26");
    expect(fall.days.map((d) => d.day)).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
    expect(fall.days.at(-1)?.weekday).toBe("Sun");
    expect(fall.label).toBe("Oct 26 – Nov 1, 2026");
    expect(fall.nextStart).toBe("2026-11-02");

    // Just after midnight on the Monday after spring forward: that Monday's week.
    const spring = sheet([], null, new Date("2026-03-09T07:05:00Z")); // 00:05 PDT, Mar 9
    expect(spring.start).toBe("2026-03-09");
    expect(spring.previousStart).toBe("2026-03-02");
    expect(sheet([], "2026-03-02").days.map((d) => d.day)).toContain("2026-03-08");
  });

  it("names both years across New Year", () => {
    expect(weekLabel("2026-12-28", "en-US")).toBe("Dec 28, 2026 – Jan 3, 2027");
  });
});

describe("the rows", () => {
  it("group medications by pass in the passes' order, then times of their own by time, by name within each", () => {
    const s = sheet([
      med({
        name: "Metformin",
        strength: "500 mg",
        dose: "1 tablet",
        schedule: { type: "scheduled", slots: [{ passId: EVENING }, { passId: MORNING }] },
      }),
      med({
        name: "lisinopril",
        strength: "10 mg",
        dose: "1 tablet",
        schedule: { type: "scheduled", slots: [{ passId: MORNING }] },
      }),
      med({
        name: "Latanoprost",
        dose: "1 drop",
        schedule: { type: "scheduled", slots: [{ time: "21:00" }] },
      }),
      med({
        name: "Vitamin D",
        schedule: { type: "scheduled", slots: [{ time: "09:00" }, { passId: NOON }] },
      }),
    ]);
    expect(s.groups.map((g) => [g.name, g.time, g.rows.map((r) => r.title)])).toEqual([
      ["Morning", "8:00", ["lisinopril 10 mg", "Metformin 500 mg"]],
      ["Lunch", "12:30", ["Vitamin D"]],
      ["Evening", "20:00", ["Metformin 500 mg"]],
      [null, "9:00", ["Vitamin D"]],
      [null, "21:00", ["Latanoprost"]],
    ]);
    expect(new Set(s.groups.flatMap((g) => g.rows.map((r) => r.key))).size).toBe(6);
  });

  it("put two medications at one time of their own in one group", () => {
    const s = sheet([
      med({ name: "B", schedule: { type: "scheduled", slots: [{ time: "14:00" }] } }),
      med({ name: "A", schedule: { type: "scheduled", slots: [{ time: "14:00" }] } }),
    ]);
    expect(s.groups).toHaveLength(1);
    expect(s.groups[0]?.rows.map((r) => r.title)).toEqual(["A", "B"]);
  });

  it("show the slot's amount, else the usual dose, else none", () => {
    const s = sheet([
      med({
        name: "Metformin",
        form: "tablet",
        dose: "1 tablet",
        schedule: {
          type: "scheduled",
          slots: [{ passId: MORNING, amount: "2 tablets" }, { passId: EVENING }],
        },
      }),
      med({ name: "Plain", schedule: { type: "scheduled", slots: [{ passId: MORNING }] } }),
    ]);
    const amounts = s.groups.flatMap((g) => g.rows.map((r) => [g.name, r.title, r.amount]));
    expect(amounts).toEqual([
      ["Morning", "Metformin", "2 tablets"],
      ["Morning", "Plain", null],
      ["Evening", "Metformin", "1 tablet"],
    ]);
    expect(s.groups[0]?.rows[0]).toMatchObject({ form: "Tablet" });
  });

  it("leave out stopped and deleted medications, and slots in unknown passes", () => {
    const s = sheet([
      med({
        name: "Done",
        status: "completed",
        stoppedOn: "2026-11-04",
        schedule: { type: "scheduled", slots: [{ passId: MORNING }] },
      }),
      med({
        name: "Gone",
        deletedAt: "2026-11-01T00:00:00Z",
        schedule: { type: "scheduled", slots: [{ passId: MORNING }] },
      }),
      med({
        name: "Lost",
        schedule: { type: "scheduled", slots: [{ passId: "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1999" }] },
      }),
      med({ name: "PRN", status: "discontinued", stoppedOn: "2026-11-04", stopReason: "other" }),
    ]);
    expect(s.groups).toEqual([]);
    expect(s.asNeeded).toEqual([]);
  });

  it("are empty with no medications", () => {
    const s = sheet([]);
    expect([s.groups, s.asNeeded]).toEqual([[], []]);
  });
});

describe("as-needed rows", () => {
  it("come by name, with the dose, the limit and blank lines", () => {
    const s = sheet([
      med({ name: "Ibuprofen", schedule: { type: "asNeeded" } }),
      med({
        name: "Acetaminophen",
        strength: "500 mg",
        dose: "2 tablets",
        schedule: { type: "asNeeded", maxPerDay: 4 },
      }),
      med({ name: "Daily", schedule: { type: "scheduled", slots: [{ passId: MORNING }] } }),
    ]);
    expect(s.asNeeded.map(({ medicationId: _id, ...row }) => row)).toEqual([
      {
        title: "Acetaminophen 500 mg",
        form: null,
        amount: "2 tablets",
        limit: "Up to 4 a day",
        lines: AS_NEEDED_LINES,
      },
      {
        title: "Ibuprofen",
        form: null,
        amount: null,
        limit: null,
        lines: AS_NEEDED_LINES,
      },
    ]);
  });
});

describe("the header", () => {
  it("reads as the medication list's", () => {
    const s = sheet([]);
    expect(s.recipient).toEqual({ name: "Patricia Example (Grandma Pat)", dateOfBirth: "Mar 14, 1941" });
    expect([s.groupName, s.printedOn]).toEqual(["Dev Family", "Nov 18, 2026"]);
  });
});

describe("the dose marks", () => {
  it("are G, S and R, one for each of the app's dose states, in its order, each with what it means", () => {
    expect(DOSE_MARKS.map((m) => [m.mark, m.state, m.label])).toEqual([
      ["G", "given", "Given"],
      ["S", "skipped", "Skipped"],
      ["R", "refused", "Refused"],
    ]);
    expect(DOSE_MARKS.map((m) => m.state)).toEqual([...DOSE_STATUSES]);
  });
});
