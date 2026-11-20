import type { UnitChoices, VitalReading } from "@caretook/data/schema";
import type { DatedReading } from "./vitalAverages";

import { describe, expect, it } from "vitest";
import { AVERAGE_VITALS, vitalAverages, windowStart } from "./vitalAverages";

const LA = "America/Los_Angeles";
// Noon on Thursday, Nov 19, in Los Angeles.
const NOW = new Date("2026-11-19T20:00:00Z");
const US: UnitChoices = { temperature: "f", weight: "lb", glucose: "mg/dL", volume: "mL" };
const METRIC: UnitChoices = { temperature: "c", weight: "kg", glucose: "mmol/L", volume: "mL" };

const at = (occurredAt: string, reading: VitalReading, deletedAt: string | null = null): DatedReading => ({
  occurredAt,
  deletedAt,
  reading,
});
const run = (readings: DatedReading[], units = US) =>
  vitalAverages(readings, { now: NOW, timeZone: LA, units });
const row = (readings: DatedReading[], type: string, units = US) =>
  run(readings, units)!.find((r) => r.type === type)!;

describe("windowStart", () => {
  it("starts at midnight in the recipient's zone, today counting as a day", () => {
    // Nov 13 00:00 PST; Oct 21 00:00 PDT (before the clocks went back).
    expect(windowStart(NOW, LA, 7).toISOString()).toBe("2026-11-13T08:00:00.000Z");
    expect(windowStart(NOW, LA, 30).toISOString()).toBe("2026-10-21T07:00:00.000Z");
  });
});

describe("vitalAverages", () => {
  it("is null with no core readings in 30 days", () => {
    expect(run([])).toBeNull();
    expect(
      run([
        at("2026-11-18T10:00:00Z", { type: "sleep", value: 7 }),
        at("2026-10-01T10:00:00Z", { type: "heartRate", value: 70 }),
      ]),
    ).toBeNull();
  });

  it("lists the six core types in order, with an empty window as no value", () => {
    const rows = run([at("2026-11-18T10:00:00Z", { type: "heartRate", value: 70 })])!;
    expect(rows.map((r) => r.type)).toEqual([...AVERAGE_VITALS]);
    expect(rows.map((r) => r.label)).toEqual([
      "Blood pressure",
      "Heart rate",
      "Temperature",
      "Weight",
      "Oxygen (SpO₂)",
      "Blood sugar",
    ]);
    expect(rows[0]!.windows).toEqual([
      { days: 7, count: 0, value: null },
      { days: 30, count: 0, value: null },
    ]);
  });

  it("averages and counts each window", () => {
    const hr = row(
      [
        at("2026-11-19T19:00:00Z", { type: "heartRate", value: 70 }),
        at("2026-11-15T19:00:00Z", { type: "heartRate", value: 80 }),
        at("2026-11-01T19:00:00Z", { type: "heartRate", value: 90 }),
      ],
      "heartRate",
    );
    expect(hr.unit).toBe("bpm");
    expect(hr.windows).toEqual([
      { days: 7, count: 2, value: "75" },
      { days: 30, count: 3, value: "80" },
    ]);
  });

  it("averages blood pressure's two numbers apart, as whole numbers", () => {
    const bp = row(
      [
        at("2026-11-18T19:00:00Z", { type: "bloodPressure", systolic: 120, diastolic: 80 }),
        at("2026-11-17T19:00:00Z", { type: "bloodPressure", systolic: 131, diastolic: 85 }),
      ],
      "bloodPressure",
    );
    expect(bp.unit).toBe("mmHg");
    // 125.5 → 126, 82.5 → 83.
    expect(bp.windows[0]).toEqual({ days: 7, count: 2, value: "126/83" });
  });

  it("converts to the user's units and rounds as the timeline does", () => {
    const readings = [
      at("2026-11-18T19:00:00Z", { type: "temperature", value: 37 }),
      at("2026-11-17T19:00:00Z", { type: "temperature", value: 37.2 }),
      at("2026-11-18T19:00:00Z", { type: "weight", value: 60 }),
      at("2026-11-18T19:00:00Z", { type: "bloodGlucose", value: 100 }),
      at("2026-11-17T19:00:00Z", { type: "bloodGlucose", value: 111 }),
      at("2026-11-18T19:00:00Z", { type: "spo2", value: 95 }),
      at("2026-11-17T19:00:00Z", { type: "spo2", value: 98 }),
    ];
    // 37.1 °C = 98.78 °F → 98.8; 60 kg = 132.28 lb → 132.3; 105.5 mg/dL → 106; 96.5% → 97.
    expect(row(readings, "temperature").windows[0]!.value).toBe("98.8");
    expect(row(readings, "temperature").unit).toBe("°F");
    expect(row(readings, "weight").windows[0]!.value).toBe("132.3");
    expect(row(readings, "bloodGlucose").windows[0]!.value).toBe("106");
    expect(row(readings, "spo2").windows[0]!.value).toBe("97");
    // Metric: 37.1 °C, 60 kg, 105.5 / 18.016 = 5.86 → 5.9 mmol/L.
    expect(row(readings, "temperature", METRIC).windows[0]!.value).toBe("37.1");
    expect(row(readings, "temperature", METRIC).unit).toBe("°C");
    expect(row(readings, "weight", METRIC).windows[0]!.value).toBe("60");
    expect(row(readings, "bloodGlucose", METRIC).windows[0]!.value).toBe("5.9");
    expect(row(readings, "bloodGlucose", METRIC).unit).toBe("mmol/L");
  });

  it("ignores readings outside the windows, after now, and on deleted entries", () => {
    const hr = row(
      [
        at("2026-11-18T19:00:00Z", { type: "heartRate", value: 70 }),
        // Just before the 7-day window (Nov 12, 23:59 in LA), inside the 30-day one.
        at("2026-11-13T07:59:00Z", { type: "heartRate", value: 100 }),
        // Just before the 30-day window.
        at("2026-10-21T06:59:00Z", { type: "heartRate", value: 200 }),
        // After now.
        at("2026-11-19T21:00:00Z", { type: "heartRate", value: 200 }),
        // Deleted.
        at("2026-11-18T10:00:00Z", { type: "heartRate", value: 200 }, "2026-11-18T11:00:00Z"),
      ],
      "heartRate",
    );
    expect(hr.windows).toEqual([
      { days: 7, count: 1, value: "70" },
      { days: 30, count: 2, value: "85" },
    ]);
  });
});
