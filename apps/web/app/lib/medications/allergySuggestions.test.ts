import { ALLERGY_LIMITS, foldSearchText } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import {
  ALLERGY_REACTIONS,
  ALLERGY_SUBSTANCES,
  reactionSuggestions,
  substanceSuggestions,
} from "./allergySuggestions";

describe("substanceSuggestions", () => {
  it("matches word prefixes, ignoring case and accents", () => {
    expect(substanceSuggestions("pen", [])).toEqual(["Penicillin"]);
    expect(substanceSuggestions("SULF", [])).toEqual(["Sulfa drugs", "Sulfites"]);
    expect(substanceSuggestions("nuts tree", [])).toEqual(["Tree nuts"]);
    expect(substanceSuggestions("nicillin", [])).toEqual([]);
    expect(substanceSuggestions("crème", [], { names: ["Creme brulee"] })).toEqual(["Creme brulee"]);
  });

  it("puts the group's own first, keeping the group's spelling over a duplicate", () => {
    expect(
      substanceSuggestions("pe", [{ substance: "Pecans" }, { substance: "penicillin" }, { substance: "  " }]),
    ).toEqual(["Pecans", "penicillin", "Peanuts"]);
    expect(substanceSuggestions("latex", [{ substance: "LATEX" }, { substance: "Látex" }])).toEqual([
      "LATEX",
    ]);
  });
});

describe("reactionSuggestions", () => {
  it("puts the group's own reactions first, skips none, matches word prefixes and de-duplicates", () => {
    const group = [{ reaction: "Swelling of the hands" }, { reaction: null }, { reaction: "swelling" }];
    expect(reactionSuggestions("SWE", group)).toEqual(["Swelling of the hands", "swelling"]);
    expect(reactionSuggestions("breath", [])).toEqual(["Trouble breathing"]);
    expect(reactionSuggestions("hívés", [])).toEqual(["Hives"]);
  });
});

describe("the curated lists", () => {
  it.each([
    ["substances", ALLERGY_SUBSTANCES, ALLERGY_LIMITS.substance],
    ["reactions", ALLERGY_REACTIONS, ALLERGY_LIMITS.reaction],
  ] as const)("%s: each once, within the field's limit", (_, names, limit) => {
    expect(new Set(names.map(foldSearchText)).size).toBe(names.length);
    expect(names.every((n) => n.length > 0 && n.length <= limit)).toBe(true);
  });
});
