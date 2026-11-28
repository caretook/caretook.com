import { describe, expect, it } from "vitest";
import { CONDITION_NAMES } from "./conditionNames";
import { CONDITION_SUGGESTION_LIMIT, conditionSuggestions } from "./conditionSuggestions";
import { foldSearchText } from "@caretook/data/domain";

describe("conditionSuggestions", () => {
  it("matches every typed word against the start of a word, in any order", () => {
    expect(conditionSuggestions("diab", [])).toEqual([
      "Diabetic neuropathy",
      "Diabetic retinopathy",
      "Pre-diabetes",
      "Type 1 diabetes",
      "Type 2 diabetes",
    ]);
    expect(conditionSuggestions("2 diab", [])).toEqual(["Type 2 diabetes"]);
    expect(conditionSuggestions("pressure high", [])).toEqual(["High blood pressure"]);
    // Case and accents are folded; a word's middle doesn't match.
    expect(conditionSuggestions("SJOGREN", [])).toEqual(["Sjögren's syndrome"]);
    expect(conditionSuggestions("abetes", [])).toEqual([]);
  });

  it("puts the group's names first, and keeps the group's spelling over a duplicate", () => {
    expect(conditionSuggestions("diabetes", ["Diabetes, type 2", "type 2 diabetes"])).toEqual([
      "Diabetes, type 2",
      "type 2 diabetes",
      "Pre-diabetes",
      "Type 1 diabetes",
    ]);
  });

  it("drops duplicates case- and accent-insensitively, and blanks", () => {
    expect(conditionSuggestions("gout", ["Gout", "GOUT", "  "])).toEqual(["Gout"]);
  });

  it("caps the list at 20, and offers the first names when nothing is typed", () => {
    expect(CONDITION_SUGGESTION_LIMIT).toBe(20);
    const all = conditionSuggestions("", ["Long COVID"]);
    expect(all).toHaveLength(20);
    expect(all[0]).toBe("Long COVID");
    expect(conditionSuggestions("c", [], { limit: 3 })).toHaveLength(3);
  });

  it("has about 150 curated names, each once", () => {
    expect(CONDITION_NAMES.length).toBeGreaterThanOrEqual(140);
    expect(new Set(CONDITION_NAMES.map(foldSearchText)).size).toBe(CONDITION_NAMES.length);
  });
});
