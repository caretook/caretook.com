import type { UnitChoices } from "@caretook/data/schema";

import { DEFAULT_UNITS, VITALS } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import { bristolOptions, inputValue, isChoiceField, isUnusualInput } from "./vitalInputs";

const METRIC: UnitChoices = { temperature: "c", weight: "kg", glucose: "mg/dL", volume: "mL" };
const temperature = VITALS.temperature.fields[0]!;
const weight = VITALS.weight.fields[0]!;
const systolic = VITALS.bloodPressure.fields[0]!;
const bristol = VITALS.bowelMovement.fields[0]!;

describe("bristolOptions", () => {
  it("offers types 1 to 7 with their descriptions", () => {
    expect(bristolOptions.map((o) => o.value)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    expect(bristolOptions[3]).toEqual({ value: "4", label: "Type 4: Smooth, soft sausage" });
  });
});

describe("isChoiceField", () => {
  it("is the Bristol type only", () => {
    expect(isChoiceField(bristol)).toBe(true);
    for (const type of ["bloodPressure", "temperature", "urineOutput", "sleep"] as const)
      for (const field of VITALS[type].fields) expect(isChoiceField(field)).toBe(false);
  });
});

describe("inputValue", () => {
  it("shows a stored value in the user's units, rounded", () => {
    expect(inputValue(temperature, 37.9, DEFAULT_UNITS)).toBe("100.2");
    expect(inputValue(temperature, 37.9, METRIC)).toBe("37.9");
    expect(inputValue(weight, 60, DEFAULT_UNITS)).toBe("132.3");
    expect(inputValue(systolic, 148, DEFAULT_UNITS)).toBe("148");
  });

  it("is empty with no stored number", () => {
    expect(inputValue(temperature, undefined, DEFAULT_UNITS)).toBe("");
    expect(inputValue(bristol, null, DEFAULT_UNITS)).toBe("");
  });
});

describe("isUnusualInput", () => {
  it("warns outside the typical range, in the user's units", () => {
    expect(isUnusualInput(temperature, 98.6, DEFAULT_UNITS)).toBe(false);
    expect(isUnusualInput(temperature, 102, DEFAULT_UNITS)).toBe(true);
    expect(isUnusualInput(temperature, 39, METRIC)).toBe(true);
    expect(isUnusualInput(systolic, 200, DEFAULT_UNITS)).toBe(true);
    expect(isUnusualInput(systolic, 120, DEFAULT_UNITS)).toBe(false);
  });

  it("never warns on a blank input or a field with no typical range", () => {
    expect(isUnusualInput(temperature, Number.NaN, DEFAULT_UNITS)).toBe(false);
    expect(isUnusualInput(weight, 400, DEFAULT_UNITS)).toBe(false);
  });
});
