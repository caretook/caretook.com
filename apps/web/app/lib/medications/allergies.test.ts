import type { AllergyLike } from "./allergies";

import { describe, expect, it } from "vitest";
import {
  allergyMatches,
  allergyState,
  allergySummary,
  allergyText,
  allergyWarning,
  sortAllergies,
} from "./allergies";

let n = 0;
const allergy = (substance: string, patch: Partial<AllergyLike> = {}): AllergyLike => ({
  id: `a${++n}`,
  substance,
  reaction: null,
  severity: "unknown",
  ...patch,
});

const penicillin = allergy("Penicillin", { reaction: "hives", severity: "severe" });
const sulfa = allergy("Sulfa drugs");
const latex = allergy("Latex", { severity: "mild" });
const codeine = allergy("Codéine", { severity: "moderate" });

describe("allergyText", () => {
  it("adds the reaction and a known severity", () => {
    expect(allergyText(penicillin)).toBe("Penicillin (hives, severe)");
    expect(allergyText(sulfa)).toBe("Sulfa drugs");
    expect(allergyText(latex)).toBe("Latex (mild)");
    expect(allergyText({ substance: "Peanuts", reaction: " swelling ", severity: "unknown" })).toBe(
      "Peanuts (swelling)",
    );
  });
});

describe("allergyState and allergySummary", () => {
  it("lists allergies, most severe first", () => {
    const state = allergyState([sulfa, latex, penicillin], null);
    expect(state.kind).toBe("recorded");
    expect(allergySummary(state)).toBe("Penicillin (hives, severe) · Latex (mild) · Sulfa drugs");
  });

  it("says No known allergies only when none are on file", () => {
    expect(allergySummary(allergyState([], "2026-11-18T09:00:00Z"))).toBe("No known allergies");
    expect(allergyState([sulfa], "2026-11-18T09:00:00Z").kind).toBe("recorded");
  });

  it("says nothing is recorded otherwise", () => {
    expect(allergySummary(allergyState([], null))).toBe("Allergies not recorded");
  });

  it("sorts by severity, then substance", () => {
    expect(sortAllergies([sulfa, codeine, latex, penicillin]).map((a) => a.substance)).toEqual([
      "Penicillin",
      "Codéine",
      "Latex",
      "Sulfa drugs",
    ]);
  });
});

describe("allergyMatches", () => {
  const all = [penicillin, sulfa, latex, codeine];
  const match = (name: string) => allergyMatches(name, all).map((a) => a.substance);

  it("matches every word of the substance in the name", () => {
    expect(match("Penicillin VK")).toEqual(["Penicillin"]);
    expect(match("penicillin")).toEqual(["Penicillin"]);
    expect(match("Sulfa drugs, topical")).toEqual(["Sulfa drugs"]);
  });

  it("matches every word of the name in the substance", () => {
    expect(match("Sulfa")).toEqual(["Sulfa drugs"]);
  });

  it("folds case and accents", () => {
    expect(match("CODEINE")).toEqual(["Codéine"]);
    expect(match("Pénicilline")).toEqual([]);
    expect(match("PÉNICILLIN g")).toEqual(["Penicillin"]);
  });

  it("never matches part of a word", () => {
    expect(match("Amoxicillin")).toEqual([]);
    expect(match("Penicil")).toEqual([]);
    expect(match("Sulfasalazine")).toEqual([]);
    expect(match("Acetaminophen with codeine-like")).toEqual(["Codéine"]);
  });

  it("matches nothing for an empty name or no allergies", () => {
    expect(match("  ")).toEqual([]);
    expect(allergyMatches("Penicillin", [])).toEqual([]);
  });

  it("returns every match, most severe first", () => {
    expect(match("Penicillin and sulfa drugs")).toEqual(["Penicillin", "Sulfa drugs"]);
  });
});

describe("allergyWarning", () => {
  it("names the match, with a known severity", () => {
    expect(allergyWarning([penicillin])).toBe("Matches an allergy on file: Penicillin (severe)");
    expect(allergyWarning([sulfa])).toBe("Matches an allergy on file: Sulfa drugs");
    expect(allergyWarning([penicillin, sulfa])).toBe(
      "Matches allergies on file: Penicillin (severe), Sulfa drugs",
    );
    expect(allergyWarning([])).toBeNull();
  });
});
