import { describe, expect, test } from "vitest";
import { matchesText, matchingText, textTokens } from "./textFilter";

describe("textTokens", () => {
  test("folds case and accents and splits on spaces", () => {
    expect(textTokens("  Café  RÉSUMÉ ")).toEqual(["cafe", "resume"]);
    expect(textTokens("   ")).toEqual([]);
  });
});

describe("matchesText", () => {
  test("every word, anywhere in any field, ignoring case and accents", () => {
    expect(matchesText(textTokens("jose card"), "Visit with José", "Cardiology")).toBe(true);
    expect(matchesText(textTokens("JOSÉ"), "jose")).toBe(true);
    expect(matchesText(textTokens("ology"), "Cardiology")).toBe(true);
    expect(matchesText(textTokens("jose dentist"), "Visit with José", "Cardiology")).toBe(false);
  });

  test("no words match everything; missing fields are skipped", () => {
    expect(matchesText([], null)).toBe(true);
    expect(matchesText(textTokens("x"), null, undefined, "")).toBe(false);
  });
});

describe("matchingText", () => {
  test("names the text, trimmed, or nothing", () => {
    expect(matchingText(" eye ")).toBe(" matching “eye”");
    expect(matchingText("")).toBe("");
  });
});
