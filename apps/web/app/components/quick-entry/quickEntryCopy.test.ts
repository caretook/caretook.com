import type { QuickEntryMedication, QuickEntryProvider } from "@caretook/data/schema";

import { DEFAULT_UNITS, parseQuickEntry } from "@caretook/data/schema";
import { describe, expect, test } from "vitest";
import { quickEntryExamples, quickEntryRules } from "./quickEntryCopy";

// The tips' example lines (B-833): the group's own provider and medication,
// else the fictional defaults; "event", not "appt"; each parses as the kind
// it shows.

const KINDS = ["vital", "dose", "symptom", "event"];

const medication = (id: string, name: string): QuickEntryMedication => ({
  id: `00000000-0000-4000-8000-00000000000${id}`,
  name,
  strength: "10 mg",
  dose: "1 tablet",
  directions: null,
  reason: null,
});
const provider = (id: string, name: string, type: QuickEntryProvider["type"]): QuickEntryProvider => ({
  id: `00000000-0000-4000-8000-00000000001${id}`,
  name,
  type,
  address: null,
});
const LISINOPRIL = medication("1", "Lisinopril");
const OKAFOR = provider("1", "Dr. Maya Okafor", "clinician");
const PRACTICE = provider("2", "Riverside Family Practice", "practice");

type Names = { medications: QuickEntryMedication[]; providers: QuickEntryProvider[] };
const kinds = (lines: readonly string[], names: Names) =>
  lines.map((line) => {
    const { parts } = parseQuickEntry(line, {
      now: new Date("2026-11-25T12:00:00Z"),
      timeZone: "America/Los_Angeles",
      units: DEFAULT_UNITS,
      ...names,
    });
    expect(parts).toHaveLength(1);
    return parts[0]!.readings[0]!.kind;
  });

describe("quickEntryExamples", () => {
  test("with none of the group's own, the fictional defaults, saying event", () => {
    const lines = quickEntryExamples();
    expect(lines).toEqual([
      "bp 130/85 hr 72",
      "gave metformin",
      "pain 4 left knee",
      "event Dr Lee Friday 2pm",
    ]);
    expect(lines.join(" ")).not.toMatch(/\bappt\b/);
    expect(quickEntryExamples({ providers: [provider("3", " ", "other")], medications: [] })).toEqual(lines);
  });

  test("they name the group's first clinician and first medication", () => {
    const lines = quickEntryExamples({ providers: [PRACTICE, OKAFOR], medications: [LISINOPRIL] });
    expect(lines[1]).toBe("gave Lisinopril");
    expect(lines[3]).toBe("event Dr. Maya Okafor Friday 2pm");
    expect(quickEntryRules(lines)).toContain("gave Lisinopril, pain 4 left knee, event Dr. Maya Okafor");
    // No clinician: the first provider.
    expect(quickEntryExamples({ providers: [PRACTICE] })[3]).toBe(
      "event Riverside Family Practice Friday 2pm",
    );
  });

  test("each default parses as the kind it shows (the dose once the group has metformin)", () => {
    expect(
      kinds(quickEntryExamples(), { medications: [medication("2", "Metformin")], providers: [] }),
    ).toEqual(KINDS);
    // With no names at all, the event still reads as one, linked to nobody.
    expect(kinds(quickEntryExamples().slice(2), { medications: [], providers: [] })).toEqual([
      "symptom",
      "event",
    ]);
  });

  test.each([
    ["a clinician", OKAFOR],
    ["a practice", PRACTICE],
  ])("with the group's own names (%s), each parses as its kind, the event linked", (_, linked) => {
    const names = { medications: [LISINOPRIL], providers: [linked] };
    const lines = quickEntryExamples(names);
    expect(kinds(lines, names)).toEqual(KINDS);
    const { parts } = parseQuickEntry(lines[3], {
      now: new Date("2026-11-25T12:00:00Z"),
      timeZone: "America/Los_Angeles",
      units: DEFAULT_UNITS,
      ...names,
    });
    expect(parts[0]!.readings[0]!.actions[0]).toMatchObject({ type: "addEvent", providerIds: [linked.id] });
  });
});
