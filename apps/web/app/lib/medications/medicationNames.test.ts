import { describe, expect, it } from "vitest";
import { suggestMedicationNames } from "./medicationNames";

const names = (...list: string[]) => list.map((name) => ({ name }));

describe("suggestMedicationNames", () => {
  const group = names("Lisinopril", "Metformin", "Folic acid", "Acetaminophen", "Latanoprost", "Losartan");

  it("matches the start of a name, case ignored", () => {
    expect(suggestMedicationNames("lis", group)).toEqual(["Lisinopril"]);
    expect(suggestMedicationNames("LA", group)).toEqual(["Latanoprost"]);
  });

  it("puts names that start with the text before names with a later word that does", () => {
    expect(suggestMedicationNames("ac", group)).toEqual(["Acetaminophen", "Folic acid"]);
  });

  it("keeps the order given within each group (most recently used first)", () => {
    expect(suggestMedicationNames("l", group)).toEqual(["Lisinopril", "Latanoprost", "Losartan"]);
  });

  it("ignores accents and surrounding spaces", () => {
    expect(suggestMedicationNames("  cafe ", names("Caféine tablets"))).toEqual(["Caféine tablets"]);
  });

  it("lists each name once, whatever its case", () => {
    expect(suggestMedicationNames("met", names("Metformin", "metformin", "METFORMIN "))).toEqual([
      "Metformin",
    ]);
  });

  it("suggests nothing for empty text, or a name that's exactly what's typed", () => {
    expect(suggestMedicationNames("", group)).toEqual([]);
    expect(suggestMedicationNames("   ", group)).toEqual([]);
    expect(suggestMedicationNames("lisinopril", group)).toEqual([]);
  });

  it("doesn't match the middle of a word", () => {
    expect(suggestMedicationNames("pril", group)).toEqual([]);
  });

  it("suggests at most five", () => {
    const many = names("A1", "A2", "A3", "A4", "A5", "A6");
    expect(suggestMedicationNames("a", many)).toHaveLength(5);
    expect(suggestMedicationNames("a", many, 2)).toEqual(["A1", "A2"]);
  });
});
