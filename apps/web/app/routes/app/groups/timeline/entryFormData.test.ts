import { DEFAULT_UNITS } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import { entryContentFromForm, entryUpdateFromForm, parseUnits, vitalInputName } from "./entryFormData";

const METRIC = { temperature: "c", weight: "kg", glucose: "mg/dL", volume: "mL" } as const;
const WHEN = "2026-11-17T10:00:00-08:00[America/Los_Angeles]";
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
};

describe("parseUnits", () => {
  it("reads the units the form showed", () => {
    expect(parseUnits(JSON.stringify(METRIC))).toEqual(METRIC);
  });

  it("falls back to the defaults on anything else", () => {
    expect(parseUnits("")).toEqual(DEFAULT_UNITS);
    expect(parseUnits("{not json")).toEqual(DEFAULT_UNITS);
    expect(parseUnits(JSON.stringify({ temperature: "k" }))).toEqual(DEFAULT_UNITS);
  });
});

describe("vitalInputName", () => {
  it("names a reading's input by index and key", () => {
    expect(vitalInputName(0, "type")).toBe("vital.0.type");
    expect(vitalInputName(2, "systolic")).toBe("vital.2.systolic");
  });
});

describe("entryContentFromForm", () => {
  it("shapes a symptom, with the time as UTC and blanks as null", () => {
    const content = entryContentFromForm(
      form({ kind: "symptom", symptomName: "Knee pain", severity: "4", body: "  ", occurredAt: WHEN }),
      DEFAULT_UNITS,
    );
    expect(content).toMatchObject({
      kind: "symptom",
      occurredAt: "2026-11-17T18:00:00.000Z",
      title: null,
      body: null,
      details: { name: "Knee pain", severity: 4 },
    });
    expect(typeof content.timeZone).toBe("string");
  });

  it("leaves an unrated severity null, and a malformed time empty", () => {
    const content = entryContentFromForm(
      form({ kind: "symptom", symptomName: "x", severity: "", occurredAt: "yesterday" }),
      DEFAULT_UNITS,
    );
    expect(content.details).toEqual({ name: "x", severity: null });
    expect(content.occurredAt).toBe("");
  });

  it("converts vitals back to stored units, in the order typed", () => {
    const content = entryContentFromForm(
      form({
        kind: "vital",
        occurredAt: WHEN,
        [vitalInputName(0, "type")]: "temperature",
        [vitalInputName(0, "value")]: "98.6",
        [vitalInputName(1, "type")]: "bloodPressure",
        [vitalInputName(1, "systolic")]: "128",
        [vitalInputName(1, "diastolic")]: "82",
      }),
      DEFAULT_UNITS,
    );
    expect(content.kind).toBe("vital");
    const readings = (content.details as { readings: Record<string, unknown>[] }).readings;
    expect(readings[0]!.type).toBe("temperature");
    expect(readings[0]!.value).toBeCloseTo(37, 5);
    expect(readings[1]).toEqual({ type: "bloodPressure", systolic: 128, diastolic: 82 });
  });

  it("keeps metric values as typed, makes blanks and junk null, and skips unknown types", () => {
    const content = entryContentFromForm(
      form({
        kind: "vital",
        [vitalInputName(0, "type")]: "weight",
        [vitalInputName(0, "value")]: "61.5",
        [vitalInputName(1, "type")]: "mood",
        [vitalInputName(2, "type")]: "urineOutput",
        [vitalInputName(2, "value")]: "",
        [vitalInputName(3, "type")]: "heartRate",
        [vitalInputName(3, "value")]: "fast",
      }),
      METRIC,
    );
    expect((content.details as { readings: unknown[] }).readings).toEqual([
      { type: "weight", value: 61.5 },
      { type: "urineOutput", value: null },
      { type: "heartRate", value: null },
    ]);
  });
});

describe("entryUpdateFromForm", () => {
  it("is the content without the kind", () => {
    const update = entryUpdateFromForm(form({ kind: "symptom", symptomName: "x" }), DEFAULT_UNITS);
    expect(update).not.toHaveProperty("kind");
    expect(update.details).toEqual({ name: "x", severity: null });
  });
});
