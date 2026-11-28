import { describe, expect, it } from "vitest";
import { describeTool } from "../registry";
import {
  addCondition,
  addEvent,
  addNote,
  addTodo,
  appendToEntry,
  givePass,
  logDose,
  logSymptom,
  logVitals,
  resolveCondition,
  todoRepeatInput,
  updateCondition,
  updateEntry,
} from "./writes";
import { parseRule } from "@caretook/data/domain";

// The write tools as tools/list sends them: each action's own fields minus
// `type`, writes marked so Claude and ChatGPT ask first.

const WRITES = [
  logVitals,
  logSymptom,
  logDose,
  givePass,
  addNote,
  addEvent,
  addTodo,
  appendToEntry,
  updateEntry,
  addCondition,
  updateCondition,
  resolveCondition,
];

const propertiesOf = (tool: (typeof WRITES)[number]) => {
  const schema = describeTool(tool).inputSchema as {
    properties: Record<string, unknown>;
    required?: string[];
  };
  return { names: Object.keys(schema.properties), required: schema.required ?? [] };
};

describe("the write tools", () => {
  it("need a read-and-write grant and are marked as writes", () => {
    for (const tool of WRITES) {
      expect(tool.scope).toBe("readWrite");
      expect(describeTool(tool).annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false });
    }
  });

  it("take each action's fields, minus its type, with the time optional", () => {
    expect(propertiesOf(logVitals)).toEqual({
      names: ["readings", "note", "occurredAt"],
      required: ["readings"],
    });
    expect(propertiesOf(logSymptom)).toEqual({
      names: ["name", "severity", "note", "occurredAt"],
      required: ["name"],
    });
    expect(propertiesOf(logDose)).toEqual({
      names: ["medicationId", "status", "amount", "note", "occurredAt"],
      required: ["medicationId", "status"],
    });
    expect(propertiesOf(givePass)).toEqual({ names: ["passId", "occurredAt"], required: ["passId"] });
    expect(propertiesOf(addNote)).toEqual({
      names: ["title", "text", "occurredAt", "providerIds"],
      required: ["text"],
    });
    expect(propertiesOf(addEvent)).toEqual({
      names: ["title", "occurredAt", "endsAt", "allDay", "place", "providerIds", "timeZone"],
      required: ["title", "occurredAt"],
    });
    // A todo's assignee is a member's name (the overview lists names, not ids).
    expect(propertiesOf(addTodo)).toEqual({
      names: ["title", "dueOn", "dueTime", "providerId", "medicationId", "eventId", "assignee", "repeat"],
      required: ["title"],
    });
    // The edits name their entry: lines to add, or a new title or time.
    expect(propertiesOf(appendToEntry)).toEqual({
      names: ["entryId", "lines"],
      required: ["entryId", "lines"],
    });
    expect(propertiesOf(updateEntry)).toEqual({
      names: ["entryId", "title", "occurredAt"],
      required: ["entryId"],
    });
    // Conditions: the content fields, and an id for the two that name one.
    expect(propertiesOf(addCondition)).toEqual({
      names: ["name", "sinceYear", "sinceMonth", "note", "diagnosedById"],
      required: ["name"],
    });
    expect(propertiesOf(updateCondition)).toEqual({
      names: ["conditionId", "name", "status", "sinceYear", "sinceMonth", "note", "diagnosedById"],
      required: ["conditionId"],
    });
    expect(propertiesOf(resolveCondition)).toEqual({
      names: ["conditionId"],
      required: ["conditionId"],
    });
  });

  it("limit an append to 50 lines, each a paragraph or a bullet", () => {
    const schema = describeTool(appendToEntry).inputSchema as { properties: Record<string, unknown> };
    const lines = schema.properties.lines;
    expect(lines).toMatchObject({
      type: "array",
      minItems: 1,
      maxItems: 50,
      items: { properties: { style: { enum: ["paragraph", "bullet"] } }, required: ["text"] },
    });
    expect(appendToEntry.description).toMatch(/5,000 characters/);
  });

  it("say which units vitals take", () => {
    expect(logVitals.description).toMatch(/°C/);
    expect(logVitals.description).toMatch(/kg/);
    expect(logVitals.description).toMatch(/mg\/dL/);
  });

  it("say notes are for what has happened, and that a todo is for later", () => {
    for (const tool of [addNote, appendToEntry, updateEntry])
      expect(tool.description).toMatch(/has happened/);
    expect(addNote.description).toMatch(/add_todo/);
    for (const tool of WRITES) expect(describeTool(tool).description).not.toMatch(/reminder/i);
  });

  it("add_todo takes a structured repeat, never RRULE text (B-253)", () => {
    expect(propertiesOf(addTodo).names).not.toContain("repeatRule");
    const schema = describeTool(addTodo).inputSchema as { properties: Record<string, unknown> };
    expect(schema.properties.repeat).toMatchObject({
      type: "object",
      properties: {
        every: { enum: ["day", "week", "month"] },
        interval: { minimum: 1, maximum: 99 },
        weekdays: { items: { enum: ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] } },
      },
      required: ["every"],
    });
    expect(addTodo.description).toMatch(/repeat/);
    expect(addTodo.description).toMatch(/stops a repeat in the app/);
  });
});

// 2026-11-24 is a Tuesday, 2026-11-23 a Monday.
const TUESDAY = "2026-11-24";
const MONDAY = "2026-11-23";

describe("todoRepeatInput", () => {
  it.each([
    ["every day", { every: "day" }, null, TUESDAY, "FREQ=DAILY;INTERVAL=1", TUESDAY],
    [
      "every 2 days from a due day",
      { every: "day", interval: 2 },
      "2026-12-01",
      TUESDAY,
      "FREQ=DAILY;INTERVAL=2",
      "2026-12-01",
    ],
    [
      "every week from a due day: that weekday",
      { every: "week" },
      "2026-11-27",
      TUESDAY,
      "FREQ=WEEKLY;INTERVAL=1;BYDAY=FR",
      "2026-11-27",
    ],
    [
      "every week with no due day: today's weekday",
      { every: "week" },
      null,
      TUESDAY,
      "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU",
      TUESDAY,
    ],
    [
      "MO, WE, FR on a Tuesday: starts Wednesday",
      { every: "week", weekdays: ["MO", "WE", "FR"] },
      null,
      TUESDAY,
      "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR",
      "2026-11-25",
    ],
    [
      "MO, WE, FR on a Monday: starts today",
      { every: "week", weekdays: ["FR", "MO", "WE"] },
      null,
      MONDAY,
      "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR",
      MONDAY,
    ],
    [
      "a due day on a listed weekday is kept",
      { every: "week", interval: 2, weekdays: ["MO", "WE", "FR"] },
      "2026-11-27",
      TUESDAY,
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR",
      "2026-11-27",
    ],
    [
      "every month from the 15th",
      { every: "month" },
      "2026-12-15",
      TUESDAY,
      "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15",
      "2026-12-15",
    ],
    // As quick entry's "every month on the 31st" (readRepeat): months without one are skipped.
    [
      "every month from the 31st",
      { every: "month" },
      "2026-12-31",
      TUESDAY,
      "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=31",
      "2026-12-31",
    ],
    [
      "every 3 months with no due day: today's date",
      { every: "month", interval: 3 },
      null,
      TUESDAY,
      "FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=24",
      TUESDAY,
    ],
  ] as const)("%s", (_name, repeat, dueOn, today, repeatRule, due) => {
    const worked = todoRepeatInput(
      { ...repeat, weekdays: "weekdays" in repeat ? [...repeat.weekdays] : undefined },
      dueOn,
      today,
    );
    expect(worked).toEqual({ repeatRule, dueOn: due });
    expect(parseRule(repeatRule).ok).toBe(true);
  });

  it("refuses a due day off the repeat's days, naming the next one", () => {
    expect(todoRepeatInput({ every: "week", weekdays: ["MO", "WE", "FR"] }, TUESDAY, MONDAY)).toEqual({
      issue: {
        path: "repeat",
        message: "The due day isn't one of the repeat's days. The next one is 2026-11-25.",
      },
    });
  });

  it.each([
    ["an interval beyond the limit", { every: "day", interval: 100 }],
    ["an interval below 1", { every: "week", interval: 0 }],
    ["weekdays with every day", { every: "day", weekdays: ["MO"] }],
    ["weekdays with every month", { every: "month", weekdays: ["MO"] }],
  ] as const)("refuses %s", (_name, repeat) => {
    const worked = todoRepeatInput(
      { ...repeat, weekdays: "weekdays" in repeat ? [...repeat.weekdays] : undefined },
      null,
      TUESDAY,
    );
    expect(worked).toMatchObject({ issue: { path: "repeat" } });
  });
});
