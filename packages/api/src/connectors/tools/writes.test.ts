import { describe, expect, it } from "vitest";
import { describeTool } from "../registry";
import {
  addEvent,
  addNote,
  addTask,
  appendToEntry,
  givePass,
  logDose,
  logSymptom,
  logVitals,
  updateEntry,
} from "./writes";

// The write tools as tools/list sends them: each action's own fields minus
// `type`, writes marked so Claude and ChatGPT ask first.

const WRITES = [
  logVitals,
  logSymptom,
  logDose,
  givePass,
  addNote,
  addEvent,
  addTask,
  appendToEntry,
  updateEntry,
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
    expect(propertiesOf(addNote)).toEqual({ names: ["title", "text", "occurredAt"], required: ["text"] });
    expect(propertiesOf(addEvent)).toEqual({
      names: ["title", "occurredAt", "endsAt", "allDay", "place", "providerIds", "timeZone"],
      required: ["title", "occurredAt"],
    });
    // A task's assignee is a member's name (the overview lists names, not ids).
    expect(propertiesOf(addTask)).toEqual({
      names: ["title", "dueOn", "dueTime", "providerId", "medicationId", "eventId", "assignee"],
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
});
