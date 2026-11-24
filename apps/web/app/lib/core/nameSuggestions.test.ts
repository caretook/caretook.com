import { describe, expect, it } from "vitest";
import { NAME_SUGGESTION_LIMIT, suggestNames } from "./nameSuggestions";

const CURATED = ["Apple", "Banana bread", "Blue cheese", "Crème brûlée", "Bread pudding"];

describe("suggestNames", () => {
  it("matches every typed word against the start of a word, in any order, folding case and accents", () => {
    expect(suggestNames("bre", [], CURATED)).toEqual(["Banana bread", "Bread pudding"]);
    expect(suggestNames("pud BRE", [], CURATED)).toEqual(["Bread pudding"]);
    expect(suggestNames("creme brulee", [], CURATED)).toEqual(["Crème brûlée"]);
    expect(suggestNames("read", [], CURATED)).toEqual([]);
  });

  it("puts the group's names first, keeps their spelling over a curated duplicate, and drops blanks", () => {
    expect(suggestNames("b", ["  ", "blue CHEESE", "Brie", "brie"], CURATED)).toEqual([
      "blue CHEESE",
      "Brie",
      "Banana bread",
      "Crème brûlée",
      "Bread pudding",
    ]);
  });

  it("caps at the limit (20 by default), and offers the first names when nothing is typed", () => {
    expect(NAME_SUGGESTION_LIMIT).toBe(20);
    const many = Array.from({ length: 30 }, (_, i) => `Name ${i}`);
    expect(suggestNames("", ["Mine"], many)).toHaveLength(20);
    expect(suggestNames("", ["Mine"], many)[0]).toBe("Mine");
    expect(suggestNames("n", [], many, 3)).toEqual(["Name 0", "Name 1", "Name 2"]);
  });
});
