import type { UnitChoices, VitalReading } from "..";

import { describe, expect, it } from "vitest";
import {
  BP_ORDER_MESSAGE,
  DEFAULT_UNITS,
  formatReading,
  fromDisplay,
  isUnusual,
  resolveUnits,
  timelineEntryContentZSchema,
  toDisplay,
  vitalDetailsZSchema,
  VITALS,
} from "..";

const METRIC: UnitChoices = { temperature: "c", weight: "kg", glucose: "mmol/L", volume: "mL" };
const US: UnitChoices = { temperature: "f", weight: "lb", glucose: "mg/dL", volume: "fl oz" };
const field = (type: keyof typeof VITALS) => VITALS[type].fields[0]!;

const parse = (readings: unknown[]) => vitalDetailsZSchema.safeParse({ readings });
const paths = (readings: unknown[]) => {
  const res = parse(readings);
  return res.success ? [] : res.error.issues.map((i) => i.path.join("."));
};

describe("unit conversion", () => {
  it("round-trips what people type, at display precision", () => {
    const cases: [keyof typeof VITALS, UnitChoices, number][] = [
      ["temperature", US, 98.6],
      ["temperature", US, 101.3],
      ["temperature", METRIC, 37.2],
      ["weight", US, 150],
      ["weight", US, 162.4],
      ["bloodGlucose", METRIC, 5.6],
      ["bloodGlucose", US, 110],
      ["urineOutput", US, 8.5],
    ];
    for (const [type, units, typed] of cases) {
      const f = field(type);
      expect(toDisplay(f, fromDisplay(f, typed, units), units)).toBe(typed);
    }
  });

  it("stores canonical units", () => {
    expect(fromDisplay(field("temperature"), 212, US)).toBeCloseTo(100);
    expect(fromDisplay(field("weight"), 1, US)).toBeCloseTo(0.45359237);
    expect(fromDisplay(field("bloodGlucose"), 1, METRIC)).toBeCloseTo(18.016);
    expect(fromDisplay(field("urineOutput"), 1, US)).toBeCloseTo(29.5735);
    // Fixed-unit measures pass through.
    expect(fromDisplay(field("heartRate"), 72, US)).toBe(72);
  });

  it("fills in default units", () => {
    expect(resolveUnits(null)).toEqual(DEFAULT_UNITS);
    expect(resolveUnits({ units: { temperature: "c" } })).toEqual({ ...DEFAULT_UNITS, temperature: "c" });
  });
});

describe("validation", () => {
  it("accepts a typical sitting", () => {
    expect(
      parse([
        { type: "bloodPressure", systolic: 128, diastolic: 82 },
        { type: "heartRate", value: 71 },
        { type: "temperature", value: 37 },
        { type: "spo2", value: 97 },
        { type: "respiratoryRate", value: 16 },
        { type: "weight", value: 68.04 },
        { type: "bloodGlucose", value: 104 },
        { type: "bowelMovement", bristol: 4 },
        { type: "urineOutput", value: 250 },
        { type: "sleep", value: 7.5 },
      ]).success,
    ).toBe(true);
  });

  it("rejects impossible values", () => {
    expect(paths([{ type: "heartRate", value: 400 }])).toEqual(["readings.0.value"]);
    expect(paths([{ type: "temperature", value: 98.6 }])).toEqual(["readings.0.value"]); // °F stored as °C
    expect(paths([{ type: "spo2", value: 101 }])).toEqual(["readings.0.value"]);
    expect(paths([{ type: "painScore", value: 3 }])).toEqual(["readings.0.type"]); // pain is a symptom
    expect(paths([{ type: "bowelMovement", bristol: 8 }])).toEqual(["readings.0.bristol"]);
    expect(paths([{ type: "heartRate", value: 71.5 }])).toEqual(["readings.0.value"]); // whole numbers
    expect(paths([{ type: "sleep", value: 25 }])).toEqual(["readings.0.value"]);
  });

  it("accepts the edges of the hard limits after conversion", () => {
    const f = field("temperature");
    expect(parse([{ type: "temperature", value: fromDisplay(f, 113, US) }]).success).toBe(true);
    expect(parse([{ type: "temperature", value: fromDisplay(f, 77, US) }]).success).toBe(true);
  });

  it("needs the bottom blood pressure number lower than the top", () => {
    const res = parse([{ type: "bloodPressure", systolic: 80, diastolic: 120 }]);
    expect(res.success).toBe(false);
    expect(res.error?.issues[0]).toMatchObject({
      path: ["readings", 0, "diastolic"],
      message: BP_ORDER_MESSAGE,
    });
  });

  it("allows an unrated bowel movement and unmeasured urine", () => {
    expect(parse([{ type: "bowelMovement", bristol: null }, { type: "urineOutput" }]).success).toBe(true);
  });

  it("needs at least one reading, each type once, and no extra fields", () => {
    expect(paths([])).toEqual(["readings"]);
    expect(
      paths([
        { type: "heartRate", value: 70 },
        { type: "heartRate", value: 72 },
      ]),
    ).toEqual(["readings"]);
    expect(paths([{ type: "heartRate", value: 70, unit: "bpm" }])).toEqual(["readings.0"]);
    expect(paths([{ type: "heartRate" }])).toEqual(["readings.0.value"]);
  });

  it("is a timeline entry kind", () => {
    const entry = {
      kind: "vital",
      occurredAt: "2026-11-17T12:00:00.000Z",
      timeZone: "America/Los_Angeles",
      details: { readings: [{ type: "heartRate", value: 70 }] },
    };
    expect(timelineEntryContentZSchema.safeParse(entry).success).toBe(true);
    expect(timelineEntryContentZSchema.safeParse({ ...entry, details: { name: "Pain" } }).success).toBe(
      false,
    );
  });
});

describe("unusual values", () => {
  it("flags readings outside the typical range", () => {
    expect(isUnusual(field("heartRate"), 150)).toBe(true);
    expect(isUnusual(field("heartRate"), 72)).toBe(false);
    expect(isUnusual(field("temperature"), 39.5)).toBe(true);
    // No typical range: never unusual.
    expect(isUnusual(field("weight"), 300)).toBe(false);
  });
});

describe("formatReading", () => {
  const cases: [VitalReading, UnitChoices, string][] = [
    [{ type: "bloodPressure", systolic: 128, diastolic: 82 }, US, "BP 128/82 mmHg"],
    [{ type: "heartRate", value: 71 }, US, "HR 71 bpm"],
    [{ type: "temperature", value: 37 }, US, "Temp 98.6 °F"],
    [{ type: "temperature", value: 37 }, METRIC, "Temp 37 °C"],
    [{ type: "spo2", value: 97 }, US, "SpO₂ 97%"],
    [{ type: "weight", value: 68.0389 }, US, "Weight 150 lb"],
    [{ type: "bloodGlucose", value: 100 }, METRIC, "Glucose 5.6 mmol/L"],
    [{ type: "bowelMovement", bristol: 4 }, US, "BM type 4"],
    [{ type: "bowelMovement", bristol: null }, US, "BM"],
    [{ type: "urineOutput", value: 250 }, METRIC, "Urine 250 mL"],
    [{ type: "urineOutput", value: null }, METRIC, "Urine (not measured)"],
    [{ type: "sleep", value: 7.5 }, US, "Sleep 7.5 h"],
    [{ type: "respiratoryRate", value: 18 }, US, "Resp 18/min"],
  ];
  it.each(cases)("%j → %s", (reading, units, expected) => {
    expect(formatReading(reading, units)).toBe(expected);
  });
});
