import { describe, expect, it } from "vitest";
import { MEDICATION_TYPES } from "./medication";
import {
  MEDICATION_TYPE_BADGES,
  MEDICATION_TYPE_GROUPS,
  MEDICATION_TYPE_LABELS,
  TYPE_NOT_SET,
  medicationTypeBadge,
  medicationTypeDetail,
  medicationTypeGroupHeading,
  medicationTypeLabel,
} from "./medicationTypeDisplay";

describe("medication type wording", () => {
  it("names each type", () => {
    expect(MEDICATION_TYPES.map(medicationTypeLabel)).toEqual([
      "Prescription",
      "Over the counter",
      "Supplement",
      "Other",
    ]);
    expect(Object.keys(MEDICATION_TYPE_LABELS)).toEqual([...MEDICATION_TYPES]);
  });

  it("gives each type a badge", () => {
    expect(MEDICATION_TYPES.map(medicationTypeBadge)).toEqual(["Rx", "OTC", "Supplement", "Other"]);
    expect(Object.keys(MEDICATION_TYPE_BADGES)).toEqual([...MEDICATION_TYPES]);
  });

  it("says a type that isn't set is not set, with no badge", () => {
    expect(TYPE_NOT_SET).toBe("Type not set");
    expect(medicationTypeLabel(null)).toBe("Type not set");
    expect(medicationTypeLabel(undefined)).toBe("Type not set");
    expect(medicationTypeBadge(null)).toBeNull();
  });

  it("reads on the medication page after 'Type: '", () => {
    expect(medicationTypeDetail("otc")).toBe("Over the counter");
    expect(medicationTypeDetail(null)).toBe("not set");
  });

  it("orders the printed groups by type, with the ones not set last", () => {
    expect(MEDICATION_TYPE_GROUPS).toEqual(["prescription", "otc", "supplement", "other", null]);
    expect(MEDICATION_TYPE_GROUPS.map(medicationTypeGroupHeading)).toEqual([
      "Prescriptions",
      "Over the counter",
      "Supplements",
      "Other",
      "Type not set",
    ]);
  });
});
