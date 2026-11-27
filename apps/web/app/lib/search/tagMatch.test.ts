import { parseSearch } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import { matchingTagIds } from "./tagMatch";

// Which tags a search names (tags-3 slice 3): the parser's folding, every
// word a prefix of a word in the name, exclusions dropping a tag.

const TAGS = [
  { id: "bp", name: "Blood pressure" },
  { id: "urgent", name: "Urgent" },
  { id: "cafe", name: "Café visits" },
  { id: "xray", name: "X-ray follow-up" },
];

const ids = (q: string) => matchingTagIds(TAGS, parseSearch(q));

describe("matchingTagIds", () => {
  it("folds case and accents", () => {
    expect(ids("URGENT")).toEqual(["urgent"]);
    expect(ids("cafe")).toEqual(["cafe"]);
    expect(ids("CAFÉ")).toEqual(["cafe"]);
  });

  it("takes every word as a prefix of a word in the name, in any order", () => {
    expect(ids("blood")).toEqual(["bp"]);
    expect(ids("press")).toEqual(["bp"]);
    expect(ids("blood press")).toEqual(["bp"]);
    expect(ids("pressure blood")).toEqual(["bp"]);
    expect(ids("bloods")).toEqual([]);
    expect(ids("blood urgent")).toEqual([]);
    expect(ids("ood")).toEqual([]);
  });

  it("keeps a phrase in order, and a quoted word whole", () => {
    expect(ids('"blood pressure"')).toEqual(["bp"]);
    expect(ids('"pressure blood"')).toEqual([]);
    expect(ids('"blood"')).toEqual(["bp"]);
    expect(ids('"bloo"')).toEqual([]);
    expect(ids("x-ray")).toEqual(["xray"]);
    expect(ids("follow-u")).toEqual(["xray"]);
  });

  it("drops a tag an exclusion names", () => {
    expect(ids("blood -pressure")).toEqual([]);
    expect(ids("blood -urgent")).toEqual(["bp"]);
  });

  it("names none for an empty or exclusion-only search", () => {
    expect(ids("")).toEqual([]);
    expect(ids("   ")).toEqual([]);
    expect(ids("-urgent")).toEqual([]);
    expect(matchingTagIds([], parseSearch("urgent"))).toEqual([]);
  });
});
