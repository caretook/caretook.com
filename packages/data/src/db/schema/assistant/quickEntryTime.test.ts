import type { QuickEntryContext } from "./quickEntry";

import { describe, expect, test } from "vitest";
import { parseQuickEntry } from "./quickEntry";
import { findTime } from "./quickEntryTime";

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
    "2nd tylenol",
    "the 2nd tylenol",
    "the 2nd dose",
    "2nd evening dose",
    "2nd night in a row",
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
    ["on the 2nd", { date: 2 }],
    ["on 2nd", { date: 2 }],
    ["dr lee the 2nd", { date: 2 }],
    ["25th at 2pm", { date: 25 }],
    ["the 25th at night", { date: 25 }],
    ["the 25th in the morning", { date: 25 }],
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
