import type { UnitChoices } from "@caretook/data/schema";
import type { SummaryEntry } from "./daySummary";

import { describe, expect, it } from "vitest";
import {
  baselineStart,
  daySummary,
  shiftDayKey,
  summariesByDay,
  summaryLabel,
  summaryText,
} from "./daySummary";

const LA = "America/Los_Angeles";
const UNITS: UnitChoices = { temperature: "f", weight: "lb", glucose: "mg/dL", volume: "mL" };
const NAMES: Record<string, string> = { ann: "Ann Lee", sam: "Sam Okafor" };
const context = { units: UNITS, nameOf: (id: string) => NAMES[id] ?? "Former member" };

/** A loosely typed entry: rows can hold readings this build doesn't know. */
const base = (kind: SummaryEntry["kind"], occurredAt: string, createdBy = "ann", extra: object = {}) =>
  ({ kind, occurredAt, title: null, details: null, createdBy, cancelledAt: null, ...extra }) as SummaryEntry;
const bp = (at: string, systolic: number, diastolic: number, by = "ann") =>
  base("vital", at, by, { details: { readings: [{ type: "bloodPressure", systolic, diastolic }] } });
const hr = (at: string, value: number) =>
  base("vital", at, "ann", { details: { readings: [{ type: "heartRate", value }] } });
const symptom = (at: string, name: string, severity: number | null = null, by = "ann") =>
  base("symptom", at, by, { details: { name, severity } });
const event = (at: string, title: string | null, cancelledAt: string | null = null) =>
  base("event", at, "ann", { title, cancelledAt });
const note = (at: string, by = "ann") => base("note", at, by);
const dose = (at: string, by = "sam") =>
  base("dose", at, by, { details: { medicationId: "m", status: "given" } });

const DAY = "2026-11-18T18:00:00Z";
const BEFORE = "2026-11-15T18:00:00Z";

describe("daySummary", () => {
  it("is empty for an empty day", () => {
    expect(daySummary([], [], context)).toEqual({ parts: [], lines: [] });
  });

  it("is empty for a day of doses only (doses aren't summarised)", () => {
    expect(daySummary([dose(DAY)], [], context).parts).toEqual([]);
  });

  it("sums up vitals, symptoms, events, notes and who logged, in that order", () => {
    const day = [
      note("2026-11-18T22:00:00Z", "sam"),
      bp("2026-11-18T20:00:00Z", 141, 88),
      event("2026-11-18T19:00:00Z", "Fell in bathroom"),
      symptom("2026-11-18T18:30:00Z", "Pain", 6, "sam"),
      note("2026-11-18T18:10:00Z"),
      bp("2026-11-18T17:00:00Z", 128, 80),
      note("2026-11-18T16:00:00Z"),
      dose("2026-11-18T15:00:00Z", "ann"),
    ];
    const baseline = [bp(BEFORE, 125, 78), bp(BEFORE, 138, 86)];
    const summary = daySummary(day, baseline, context);
    expect(summaryText(summary.parts)).toBe(
      "BP 128–141/80–88 ↑ · Pain 6 (new) · Fell in bathroom · 3 notes · Ann, Sam",
    );
    expect(summary.parts[0]).toMatchObject({ direction: "up", directionLabel: "higher than last week" });
    expect(summaryLabel(summary.parts)).toBe(
      "BP 128–141/80–88, higher than last week; Pain 6 (new); Fell in bathroom; 3 notes; Ann, Sam",
    );
    expect(summary.lines.map((l) => l.label)).toEqual(["Vitals", "Symptoms", "Events", "Notes", "Logged by"]);
  });

  it("marks a symptom new only when the baseline didn't have it (any case or spacing)", () => {
    // The latest spelling names it: "Pain" was logged after "pain".
    const day = [
      symptom(DAY, "Nausea", 3),
      symptom("2026-11-18T19:00:00Z", "Pain", 4),
      symptom(DAY, "pain", 7),
    ];
    const summary = daySummary(day, [symptom(BEFORE, "  NAUSEA ")], context);
    // Highest severity first, and the highest severity of each.
    expect(summaryText(summary.parts)).toBe("Pain 7 (new) · Nausea 3 · Ann");
  });

  it("shows a symptom with no severity by name", () => {
    expect(summaryText(daySummary([symptom(DAY, "Dizzy")], [], context).parts)).toBe("Dizzy (new) · Ann");
  });

  it("leaves cancelled events out, and names an untitled event", () => {
    const day = [event(DAY, "Dialysis", DAY), event(DAY, null), event(DAY, "Walk")];
    expect(summaryText(daySummary(day, [], context).parts)).toBe("Event · Walk · Ann");
  });

  it("gives a type absent from the baseline an arrow only in the unusual band", () => {
    expect(daySummary([hr(DAY, 72)], [], context).parts[0]).toEqual({ kind: "vital", text: "HR 72 bpm" });
    expect(daySummary([hr(DAY, 72)], [bp(BEFORE, 120, 80)], context).parts[0]!.direction).toBeUndefined();
    expect(daySummary([bp(DAY, 190, 95)], [], context).parts[0]).toMatchObject({
      text: "BP 190/95",
      direction: "up",
      directionLabel: "unusually high",
    });
    expect(daySummary([hr(DAY, 35)], [], context).parts[0]).toMatchObject({ direction: "down" });
  });

  it("puts the unusual band before the baseline, and points down below the baseline", () => {
    // Within last week's range of highs, but unusual: still up.
    expect(daySummary([bp(DAY, 185, 90)], [bp(BEFORE, 190, 92)], context).parts[0]!.direction).toBe("up");
    expect(daySummary([hr(DAY, 58)], [hr(BEFORE, 64), hr(BEFORE, 80)], context).parts[0]).toMatchObject({
      direction: "down",
      directionLabel: "lower than last week",
    });
    // Within the baseline: no arrow. Both above and below it: no arrow either.
    expect(
      daySummary([hr(DAY, 70)], [hr(BEFORE, 64), hr(BEFORE, 80)], context).parts[0]!.direction,
    ).toBeUndefined();
    expect(
      daySummary([hr(DAY, 60), hr(DAY, 90)], [hr(BEFORE, 64), hr(BEFORE, 80)], context).parts[0]!.direction,
    ).toBeUndefined();
  });

  it("shows readings in the viewer's units, and counts bowel movements", () => {
    const temp = base("vital", DAY, "ann", { details: { readings: [{ type: "temperature", value: 37 }] } });
    const bm = (bristol: number | null) =>
      base("vital", DAY, "ann", { details: { readings: [{ type: "bowelMovement", bristol }] } });
    expect(daySummary([temp], [], context).parts[0]!.text).toBe("Temp 98.6 °F");
    expect(daySummary([temp], [], { ...context, units: { ...UNITS, temperature: "c" } }).parts[0]!.text).toBe(
      "Temp 37 °C",
    );
    expect(daySummary([bm(4), bm(6), bm(null)], [], context).parts[0]!.text).toBe("BM ×3 type 4–6");
  });

  it("skips readings this build doesn't know", () => {
    const odd = base("vital", DAY, "ann", { details: { readings: [{ type: "mood", value: 3 }] } });
    expect(daySummary([odd], [], context).parts).toEqual([]);
  });

  it("uses full names when two authors share a first name", () => {
    const names = { a: "Sam Lee", b: "Sam Okafor", c: "Ann Lee" };
    const ctx = { units: UNITS, nameOf: (id: string) => names[id as keyof typeof names] };
    const day = [note(DAY, "a"), note(DAY, "b"), note(DAY, "c")];
    expect(daySummary(day, [], ctx).lines.at(-1)!.parts[0]!.text).toBe("Sam Lee, Sam Okafor, Ann");
  });
});

describe("summariesByDay", () => {
  it("compares each day with the 7 days before it, by calendar day across a DST change", () => {
    // Clocks went back in Los Angeles on Sunday, Nov 1 2026.
    const entries = [
      symptom("2026-11-06T02:00:00Z", "Cough"), // Nov 5, 19:00 PDT... baseline for Nov 8 and Nov 12
      symptom("2026-11-01T07:30:00Z", "Cough"), // 00:30 PDT on Nov 1
      symptom("2026-11-02T07:30:00Z", "Rash"), // 23:30 PST on Nov 1
      symptom("2026-10-25T19:00:00Z", "Rash"), // Oct 25: 7 days before Nov 1
      symptom("2026-10-24T19:00:00Z", "Cough"), // Oct 24: 8 days before Nov 1, outside
    ];
    const days = summariesByDay(entries, ["2026-11-01", "2026-11-05"], LA, context);
    expect(summaryText(days.get("2026-11-01")!.parts)).toBe("Cough (new) · Rash · Ann");
    expect(summaryText(days.get("2026-11-05")!.parts)).toBe("Cough · Ann");
  });

  it("gives a day with nothing in it an empty summary", () => {
    expect(summariesByDay([], ["2026-11-18"], LA, context).get("2026-11-18")).toEqual({
      parts: [],
      lines: [],
    });
  });
});

describe("day keys", () => {
  it("shifts by calendar days and starts the baseline early enough for any zone", () => {
    expect(shiftDayKey("2026-11-01", -7)).toBe("2026-10-25");
    expect(shiftDayKey("2026-03-08", 1)).toBe("2026-03-09");
    expect(baselineStart("2026-11-18")).toBe("2026-11-10T00:00:00.000Z");
  });
});
