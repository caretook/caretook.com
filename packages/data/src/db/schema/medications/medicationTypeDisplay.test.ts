import { describe, expect, it } from "vitest";
import { MEDICATION_TYPES } from "./medication";
import {
  MEDICATION_TYPE_GROUPS,
  TYPE_NOT_SET,
  medicationTypeBadge,
  medicationTypeDetail,
  medicationTypeGroupHeading,
  medicationTypeLabel,
} from "./medicationTypeDisplay";

describe("medication type wording", () => {
  it("words every type, says one not set is not set with no badge, and prints the unset group last", () => {
    for (const type of MEDICATION_TYPES) {
      expect(medicationTypeLabel(type)).toBeTruthy();
      expect(medicationTypeBadge(type)).toBeTruthy();
      expect(medicationTypeDetail(type)).toBe(medicationTypeLabel(type));
      expect(medicationTypeGroupHeading(type)).toBeTruthy();
    }
    expect(medicationTypeLabel(null)).toBe(TYPE_NOT_SET);
    expect(medicationTypeLabel(undefined)).toBe(TYPE_NOT_SET);
    expect(medicationTypeBadge(null)).toBeNull();
    expect(medicationTypeDetail(null)).toBe("not set");
    expect(MEDICATION_TYPE_GROUPS).toEqual([...MEDICATION_TYPES, null]);
    expect(medicationTypeGroupHeading(null)).toBe(TYPE_NOT_SET);
  });
});
