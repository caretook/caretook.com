import type { PredictionEntry } from "./quickEntryPredictions";

import { describe, expect, it } from "vitest";
import { usualAtHour } from "./quickEntryPredictions";
import { addDays, zonedInstant } from "./zonedDay";

const ZONE = "America/Los_Angeles";

/** A wall-clock moment in the recipient's zone, as ISO 8601. */
const local = (day: string, time: string) => zonedInstant(day, time, ZONE).toISOString();

const bp = (occurredAt: string): PredictionEntry => ({
  kind: "vital",
  occurredAt,
  details: { readings: [{ type: "bloodPressure", systolic: 130, diastolic: 85 }] },
});
const vitals = (occurredAt: string, ...types: string[]): PredictionEntry => ({
  kind: "vital",
  occurredAt,
  details: { readings: types.map((type) => ({ type })) },
});
const symptom = (occurredAt: string, name: string): PredictionEntry => ({
  kind: "symptom",
  occurredAt,
  details: { name, severity: 4 },
});
const of = (kind: string, occurredAt: string): PredictionEntry => ({ kind, occurredAt, details: null });

const TODAY = "2026-11-19";
const NOW = new Date(local(TODAY, "08:10"));
/** `time` on each of the days `n` days before today. */
const onDays = (time: string, ...n: number[]) => n.map((d) => local(addDays(TODAY, -d), time));

const keys = (entries: PredictionEntry[], now = NOW) => usualAtHour(entries, now, ZONE).map((s) => s.key);

describe("usualAtHour", () => {
  it("offers a vital logged near this hour on three of the last 14 days, as its keyword", () => {
    const usual = usualAtHour(onDays("08:00", 1, 4, 9).map(bp), NOW, ZONE);
    expect(usual).toEqual([{ key: "vital:bloodPressure", label: "bp", fill: "bp ", days: 3 }]);
  });

  it("needs three different days", () => {
    expect(keys(onDays("08:00", 1, 2).map(bp))).toEqual([]);
    // Three on one day are one day.
    expect(keys([...onDays("07:30", 1), ...onDays("08:00", 1), ...onDays("08:30", 1, 2)].map(bp))).toEqual(
      [],
    );
  });

  it("counts within an hour either side, and no further", () => {
    expect(keys(onDays("07:10", 1, 2, 3).map(bp))).toEqual(["vital:bloodPressure"]);
    expect(keys(onDays("09:10", 1, 2, 3).map(bp))).toEqual(["vital:bloodPressure"]);
    expect(keys(onDays("07:05", 1, 2, 3).map(bp))).toEqual([]);
    expect(keys(onDays("09:15", 1, 2, 3).map(bp))).toEqual([]);
  });

  it("looks at the 14 days before today, not today or earlier", () => {
    expect(keys(onDays("08:00", 12, 13, 14).map(bp))).toEqual(["vital:bloodPressure"]);
    expect(keys(onDays("08:00", 13, 14, 15).map(bp))).toEqual([]);
    expect(keys([...onDays("08:00", 1, 2), local(TODAY, "08:00")].map(bp))).toEqual([]);
  });

  it("goes by the wall clock across a DST change", () => {
    // Clocks fell back on Nov 1: 07:10 PDT is 14:10Z, 08:00 PST is 16:00Z.
    const now = new Date(local("2026-11-03", "08:00"));
    const before = ["2026-10-29", "2026-10-30", "2026-10-31"].map((d) => bp(local(d, "07:10")));
    expect(keys(before, now)).toEqual(["vital:bloodPressure"]);
    // Clocks sprang forward on Mar 8: 08:50 PST is 16:50Z, 08:00 PDT is 15:00Z.
    const spring = new Date(local("2026-03-10", "08:00"));
    const beforeSpring = ["2026-03-05", "2026-03-06", "2026-03-07"].map((d) => bp(local(d, "08:50")));
    expect(keys(beforeSpring, spring)).toEqual(["vital:bloodPressure"]);
  });

  it("reaches across midnight", () => {
    const now = new Date(local(TODAY, "00:20"));
    expect(keys(onDays("23:50", 2, 3, 4).map(bp), now)).toEqual(["vital:bloodPressure"]);
  });

  it("counts each vital type of an entry, symptoms, doses and notes, most days first", () => {
    const entries = [
      ...onDays("08:00", 1, 2, 3).map((at) => vitals(at, "bloodPressure", "heartRate")),
      ...onDays("08:05", 1, 2, 3, 4).map((at) => of("dose", at)),
      ...onDays("08:20", 1, 2, 3, 4, 5).map((at) => of("note", at)),
      ...onDays("07:40", 2, 6, 7).map((at) => symptom(at, "Pain")),
      ...onDays("08:00", 1, 2, 3).map((at) => of("event", at)),
    ];
    expect(usualAtHour(entries, NOW, ZONE, 10)).toEqual([
      { key: "note", label: "note", fill: "n: ", days: 5 },
      { key: "dose", label: "gave", fill: "gave ", days: 4 },
      { key: "vital:bloodPressure", label: "bp", fill: "bp ", days: 3 },
      { key: "vital:heartRate", label: "hr", fill: "hr ", days: 3 },
      { key: "symptom", label: "pain", fill: "pain ", days: 3 },
    ]);
    expect(usualAtHour(entries, NOW, ZONE)).toHaveLength(4);
  });

  it("fills a symptom with the name used most, then the latest", () => {
    const entries = [
      symptom(onDays("08:00", 1)[0]!, "Nausea"),
      symptom(onDays("08:00", 2)[0]!, "knee pain"),
      symptom(onDays("08:00", 3)[0]!, "Knee pain"),
    ];
    expect(usualAtHour(entries, NOW, ZONE)[0]).toMatchObject({ label: "knee pain", fill: "knee pain " });
  });

  it("ignores unknown vital types, odd details and bad times", () => {
    const entries = [
      ...onDays("08:00", 1, 2, 3).map((at) => vitals(at, "telepathy")),
      ...onDays("08:00", 1, 2, 3).map((at) => ({ kind: "vital", occurredAt: at, details: "nope" })),
      { kind: "note", occurredAt: "not a time", details: null },
    ];
    expect(keys(entries)).toEqual([]);
    expect(keys([])).toEqual([]);
  });
});
