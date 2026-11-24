import { foldSearchText } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import { MEDICATION_NAMES } from "./medicationNameList";
import { MEDICATION_SUGGESTION_LIMIT, medicationNameSuggestions } from "./medicationNames";

const names = (...list: string[]) => list.map((name) => ({ name }));

describe("medicationNameSuggestions", () => {
  it("puts the group's names first, then the curated list, the group's spelling winning a duplicate", () => {
    const group = names("lisinopril", "Folic acid (1 mg)", "Lipo-flavonoid");
    expect(medicationNameSuggestions("li", group)).toEqual([
      "lisinopril",
      "Lipo-flavonoid",
      "Insulin lispro",
      "Lidocaine",
      "Linagliptin",
      "Liraglutide",
      "Lithium",
    ]);
    // A later word's start matches too; the group's spelling comes first.
    expect(medicationNameSuggestions("acid", group)).toEqual(["Folic acid (1 mg)", "Folic acid"]);
  });

  it("lists look-alikes in full, side by side, and a middle of a word doesn't match", () => {
    expect(medicationNameSuggestions("hydr", [])).toEqual([
      "Hydralazine",
      "Hydrochlorothiazide",
      "Hydrocodone-acetaminophen",
      "Hydrocortisone",
      "Hydroxychloroquine",
      "Hydroxyzine",
    ]);
    expect(medicationNameSuggestions("hydroxy", [])).toEqual(["Hydroxychloroquine", "Hydroxyzine"]);
    expect(medicationNameSuggestions("pril", [])).toEqual([]);
  });

  it("folds case and accents, matches each typed word in any order, and drops blanks", () => {
    expect(medicationNameSuggestions("  CAFE ", names("Caféine tablets", "  "))).toEqual(["Caféine tablets"]);
    expect(medicationNameSuggestions("d vit", [])).toEqual(["Calcium with vitamin D", "Vitamin D3"]);
  });

  it("caps the list", () => {
    expect(MEDICATION_SUGGESTION_LIMIT).toBe(20);
    const many = names(...Array.from({ length: 25 }, (_, i) => `Med ${i}`));
    expect(medicationNameSuggestions("m", many)).toEqual(many.slice(0, 20).map((m) => m.name));
    expect(medicationNameSuggestions("m", [], { limit: 3 })).toHaveLength(3);
  });

  it("has about 200 curated names, each once, with no strength in them", () => {
    expect(MEDICATION_NAMES.length).toBeGreaterThanOrEqual(190);
    expect(new Set(MEDICATION_NAMES.map(foldSearchText)).size).toBe(MEDICATION_NAMES.length);
    expect(MEDICATION_NAMES.filter((n) => /\d+\s*(mg|mcg|ml|g)\b/i.test(n))).toEqual([]);
  });
});
