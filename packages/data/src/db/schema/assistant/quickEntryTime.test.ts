import type { QuickEntryContext } from "./quickEntry";

import { describe, expect, test } from "vitest";
import { parseQuickEntry } from "./quickEntry";
import { findTime, resolveTime } from "./quickEntryTime";

// Words that aren't times leave the time alone. The clock is fixed in the
// recipient's zone, America/Los_Angeles, like the parser's own table.

/** Thursday, Nov 19, 2026, 8:00 in Los Angeles (16:00 UTC). */
const NOW = new Date("2026-11-19T16:00:00Z");

const context: QuickEntryContext = {
  now: NOW,
  timeZone: "America/Los_Angeles",
  units: { temperature: "f", weight: "lb", glucose: "mg/dL", volume: "mL" },
  medications: [{ id: "33333333-3333-4333-8333-333333333333", name: "Tylenol", strength: "500 mg" }],
  providers: [{ id: "55555555-5555-4555-8555-555555555555", name: "Dr. Sandra Lee", type: "clinician" }],
  members: [],
};

const find = (line: string) => findTime(line.split(" "));
const specOf = (line: string) => {
  const spec = find(line)?.spec;
  return spec && "day" in spec ? spec : undefined;
};
const top = (line: string) => parseQuickEntry(line, context).parts[0]!.readings[0]!;

describe("words that aren't times", () => {
  test.each([
    "sat up in chair",
    "sat at the table",
    "sat in the sun",
    "sun was out",
    "the sat",
    "she sat",
    "he sat",
    "they sat",
    "then she sat",
    "mom sat",
    "my mom sat",
    "2nd tylenol",
    "the 2nd tylenol",
    "the 2nd dose",
    "2nd evening dose",
    "2nd night in a row",
    "2nd floor",
    "2nd floor at the clinic",
    "the 2nd dose at the clinic",
    "2nd at least",
    "the 2nd at all",
    "2nd at first",
    "the 2nd at",
    "the 2nd at 25",
    "gave the 2nd at bedtime",
    "gave the 2nd at home",
    "took 2nd at lunch",
    "had her 2nd at the clinic",
    "her 2nd at the clinic",
    "gave a 2nd at the clinic",
    "took an 8th at the clinic",
    "received the 2nd at the clinic",
    "received a 2nd at the clinic",
    "got the 2nd at the clinic",
    "pain 8 a bit better",
    "pain 8 p",
  ])("%s has no time", (line) => {
    expect(find(line)).toBeNull();
  });
});

describe("the days they must not take away", () => {
  test.each([
    ["sat 2pm", { weekday: 6 }],
    ["sat 2 pm", { weekday: 6 }],
    ["sat at 2", { weekday: 6 }],
    ["sat morning", { weekday: 6 }],
    ["sun in the morning", { weekday: 0 }],
    ["on sat", { weekday: 6 }],
    ["last sat", { weekday: 6, modifier: "last" }],
    ["next sun", { weekday: 0, modifier: "next" }],
    ["this sat", { weekday: 6, modifier: "this" }],
    ["dr lee sat", { weekday: 6 }],
    ["appt sat", { weekday: 6 }],
    ["call mom sat", { weekday: 6 }],
    ["she sat 2pm", { weekday: 6 }],
    ["she left on sat", { weekday: 6 }],
    ["on the 2nd", { date: 2 }],
    ["on 2nd", { date: 2 }],
    ["dr lee the 2nd", { date: 2 }],
    ["25th at 2pm", { date: 25 }],
    ["the 25th at night", { date: 25 }],
    ["the 25th in the morning", { date: 25 }],
    ["dr lee the 2nd at the clinic", { date: 2 }],
    ["dr lee 2nd at kaiser", { date: 2 }],
    ["the 2nd at home", { date: 2 }],
    ["dr lee the 2nd at 123 main st", { date: 2 }],
    ["the 2nd at the clinic at 2pm", { date: 2 }],
    ["nov 2nd", { month: 11, date: 2 }],
    ["2nd nov", { month: 11, date: 2 }],
  ])("%s", (line, day) => {
    expect(specOf(line)?.day).toEqual(day);
  });

  test("a count word still guards an ordinal after 'on'", () => {
    expect(find("on the 2nd dose")).toBeNull();
  });
});

describe("am and pm", () => {
  test.each([
    ["8a", { hour: 8, minute: 0, meridiem: "am" }],
    ["8p", { hour: 8, minute: 0, meridiem: "pm" }],
    ["8:30p", { hour: 8, minute: 30, meridiem: "pm" }],
    ["8 am", { hour: 8, minute: 0, meridiem: "am" }],
    ["8 a.m.", { hour: 8, minute: 0, meridiem: "am" }],
    ["8 p.m", { hour: 8, minute: 0, meridiem: "pm" }],
    ["at 8 pm", { hour: 8, minute: 0, meridiem: "pm" }],
  ])("%s", (line, clock) => {
    expect(specOf(line)?.clock).toEqual(clock);
  });
});

describe("through the parser", () => {
  test("a member's name before a last 'sat' is the verb", () => {
    const members = [{ id: "66666666-6666-4666-8666-666666666666", name: "Sam Rivera" }];
    const timed = (line: string, extra: Partial<QuickEntryContext> = {}) =>
      parseQuickEntry(line, { ...context, members, ...extra }).parts[0]!.readings[0]!.actions[0];
    expect(timed("Sam sat")).toMatchObject({ occurredAt: NOW.toISOString() });
    expect(timed("Sam Rivera sat")).toMatchObject({ occurredAt: NOW.toISOString() });
    // Not when the name opens something else, or a provider has it too.
    expect(timed("call Sam sat")).not.toMatchObject({ occurredAt: NOW.toISOString() });
    const lee = [{ id: "66666666-6666-4666-8666-666666666666", name: "Lee Park" }];
    expect(timed("Lee sat", { members: lee })).not.toMatchObject({ occurredAt: NOW.toISOString() });
  });

  test("an ordinal before 'at a place' dates the event and keeps the place", () => {
    const r = top("dr lee the 2nd at the clinic");
    expect(r.kind).toBe("event");
    expect(r.actions[0]).toMatchObject({
      occurredAt: new Date("2026-12-02T08:00:00Z").toISOString(),
      allDay: true,
      place: "the clinic",
    });
  });

  test("an ordinal before 'at a time' keeps its clock", () => {
    const r = top("dr lee the 2nd at 2pm");
    expect(r.actions[0]).toMatchObject({
      occurredAt: new Date("2026-12-02T22:00:00Z").toISOString(),
      allDay: false,
    });
  });

  test("'sat up in chair' is a note dated now", () => {
    const r = top("sat up in chair");
    expect(r.kind).toBe("note");
    expect(r.actions[0]).toMatchObject({ occurredAt: NOW.toISOString() });
  });

  test("'pain 8 a bit better' is a symptom, severity 8, dated now", () => {
    const r = top("pain 8 a bit better");
    expect(r.kind).toBe("symptom");
    expect(r.actions[0]).toMatchObject({ severity: 8, occurredAt: NOW.toISOString() });
  });

  test("'o2 sat 95' is still oxygen, dated now", () => {
    const r = top("o2 sat 95");
    expect(r.kind).toBe("vital");
    expect(r.actions[0]).toMatchObject({ occurredAt: NOW.toISOString() });
  });
});

// Slice 4: dates and hours. Wall times below are Los Angeles (PST, UTC-8, in November).
const pst = (date: string, time: string) => new Date(`${date}T${time}:00-08:00`).toISOString();
const resolved = (line: string, direction: "past" | "future", now: Date) => {
  const spec = find(line)!.spec;
  const r = resolveTime(spec, { now, timeZone: "America/Los_Angeles", direction });
  return { at: r.at.toISOString(), allDay: r.allDay };
};
const parsedAt = (now: Date) => ({
  ...context,
  now,
  providers: [
    ...context.providers,
    { id: "66666666-6666-4666-8666-666666666666", name: "Dr. Elena Alvarez", type: "clinician" as const },
  ],
});
const topAt = (line: string, now: Date) => parseQuickEntry(line, parsedAt(now)).parts[0]!.readings[0]!;
const blockingOf = (r: ReturnType<typeof top>) => r.warnings.filter((w) => w.blocking);
const AT_7 = new Date(pst("2026-11-19", "07:00"));

describe("month/day dates", () => {
  test.each([
    ["11/25", { month: 11, date: 25 }],
    ["11/25/26", { month: 11, date: 25, year: 2026 }],
    ["11/25/2026", { month: 11, date: 25, year: 2026 }],
    ["3/10/26", { month: 3, date: 10, year: 2026 }],
    ["on 1/4", { month: 1, date: 4 }],
    ["on 1/2", { month: 1, date: 2 }],
    ["on 11/10", { month: 11, date: 10 }],
    ["2/29", { month: 2, date: 29 }],
    ["on 1/8", { month: 1, date: 8 }],
    ["on 2/5 ml", { month: 2, date: 5 }],
    ["11/25 at 2pm", { month: 11, date: 25 }],
    ["dr lee 2/14", { month: 2, date: 14 }],
    ["dr lee 3/8", { month: 3, date: 8 }],
    ["2/5/26 ml", { month: 2, date: 5, year: 2026 }],
  ])("%s", (line, day) => {
    expect(specOf(line)?.day).toEqual(day);
  });

  test.each([
    "gave 1/2 tylenol",
    "gave 1/3 tylenol",
    "gave 2/3 tylenol",
    "gave 1/4 tylenol",
    "gave 3/4 tylenol",
    "nausea 3/10",
    "6/10 pain in left knee",
    "11/10",
    "bp 120/80",
    "13/25",
    "11/31",
    "2/30",
    "2/29/26",
    "0/5",
    "gave 1/8 tsp",
    "gave 1/8 tylenol",
    "gave 2/5 ml",
    "gave 3/8 tsp",
    "1/6 tablet",
  ])("%s has no date", (line) => {
    expect(find(line)).toBeNull();
  });

  test("'11/25 at 2pm' is Nov 25, 14:00", () => {
    expect(resolved("11/25 at 2pm", "future", NOW).at).toBe(pst("2026-11-25", "14:00"));
  });

  test("'11/25' alone is all day ahead, and that day back", () => {
    expect(resolved("11/25", "future", NOW)).toEqual({ at: pst("2026-11-25", "00:00"), allDay: true });
    expect(resolved("11/25", "past", NOW)).toEqual({ at: pst("2025-11-25", "08:00"), allDay: false });
  });

  test("'on 1/4' and 'on 11/10' are those days", () => {
    expect(resolved("on 1/4", "future", NOW).at).toBe(pst("2027-01-04", "00:00"));
    expect(resolved("on 11/10", "past", NOW).at).toBe(pst("2026-11-10", "08:00"));
  });

  test("a typed year is kept, either way", () => {
    expect(resolved("11/25/26", "past", NOW).at).toBe(pst("2026-11-25", "00:00"));
    expect(resolved("1/5/26", "future", NOW).at).toBe(pst("2026-01-05", "00:00"));
  });

  test("Feb 29 without a year is the nearest leap year's", () => {
    expect(resolved("2/29", "future", NOW).at).toBe(pst("2028-02-29", "00:00"));
    expect(resolved("2/29", "past", NOW).at).toBe(pst("2024-02-29", "08:00"));
  });

  test("'dr alvarez 11/25 at 2pm' is an event on Nov 25 at 14:00", () => {
    const r = topAt("dr alvarez 11/25 at 2pm", NOW);
    expect(r.kind).toBe("event");
    expect(r.actions[0]).toMatchObject({ occurredAt: pst("2026-11-25", "14:00"), allDay: false });
  });
});

describe("a bare hour", () => {
  test.each([
    ["dr alvarez at 2", "future", "20:00", "2026-11-20", "14:00"],
    ["dr alvarez at 2", "future", "09:00", "2026-11-19", "14:00"],
    ["at 8", "future", "15:00", "2026-11-19", "20:00"],
    ["at 8", "future", "06:00", "2026-11-19", "08:00"],
    ["at 2am", "future", "20:00", "2026-11-20", "02:00"],
    ["at 05:00", "future", "20:00", "2026-11-20", "05:00"],
    ["at 5:00", "future", "20:00", "2026-11-20", "17:00"],
    ["gave tylenol at 2", "past", "09:00", "2026-11-19", "02:00"],
  ] as const)("%s read %s at %s", (line, direction, time, date, expected) => {
    const now = new Date(pst("2026-11-19", time));
    expect(resolved(line, direction, now).at).toBe(pst(date, expected));
  });
});

describe("a period that has begun", () => {
  test.each(["bp 120/80 this morning", "bp 120/80 in the morning", "n: had dialysis this morning"])(
    "%s at 7:00 is dated 7:00, unblocked",
    (line) => {
      const r = topAt(line, AT_7);
      expect(r.actions[0]).toMatchObject({ occurredAt: AT_7.toISOString() });
      expect(blockingOf(r)).toEqual([]);
    },
  );

  test("'woke at 5 this morning' is 5:00 today", () => {
    expect(topAt("woke at 5 this morning", AT_7).actions[0]).toMatchObject({
      occurredAt: pst("2026-11-19", "05:00"),
    });
  });

  test("'at 12 this morning' is the midnight that began today", () => {
    expect(topAt("woke at 12 this morning", AT_7).actions[0]).toMatchObject({
      occurredAt: pst("2026-11-19", "00:00"),
    });
  });

  test("at 10:00, 'bp 120/80 this morning' is 8:00", () => {
    const r = topAt("bp 120/80 this morning", new Date(pst("2026-11-19", "10:00")));
    expect(r.actions[0]).toMatchObject({ occurredAt: pst("2026-11-19", "08:00") });
  });

  test("before it begins, a past-only kind is still blocked", () => {
    const r = topAt("bp 120/80 this morning", new Date(pst("2026-11-19", "03:00")));
    expect(blockingOf(r).map((w) => w.message)).toEqual(["Can't be in the future"]);
  });

  test.each([
    ["call the pharmacy this afternoon", "12:30"],
    ["call the pharmacy tonight", "21:00"],
    ["walk this evening", "10:00"],
  ])("%s at %s is a todo first, its note dated now", (line, time) => {
    const now = new Date(pst("2026-11-19", time));
    const readings = parseQuickEntry(line, parsedAt(now)).parts[0]!.readings;
    expect(readings[0]!.kind).toBe("todo");
    expect(readings.find((r) => r.kind === "note")!.actions[0]).toMatchObject({
      occurredAt: now.toISOString(),
    });
  });

  test("'last night' is unchanged", () => {
    const now = new Date(pst("2026-11-19", "21:00"));
    expect(topAt("bp 120/80 last night", now).actions[0]).toMatchObject({
      occurredAt: pst("2026-11-18", "22:00"),
    });
  });
});
