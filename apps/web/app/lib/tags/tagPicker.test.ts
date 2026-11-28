import { describe, expect, it } from "vitest";
import { chipSplit, exactTag, matchingTags, namedFirst, newTagName } from "./tagPicker";

const tag = (name: string) => ({ id: `id-${name}`, name, name_key: name.toLowerCase() });
const URGENT = tag("Urgent");
const MOVE = tag("Care home move");
const KNEE = tag("Knee surgery");
const TAGS = [MOVE, KNEE, URGENT];

describe("matching (matchingTags)", () => {
  it("keeps every tag while nothing is typed", () => {
    expect(matchingTags(TAGS, "")).toEqual(TAGS);
    expect(matchingTags(TAGS, "   ")).toEqual(TAGS);
  });

  it("keeps tags holding the typed text, in any case or spacing", () => {
    expect(matchingTags(TAGS, "UR")).toEqual([KNEE, URGENT]);
    expect(matchingTags(TAGS, "  home   MOVE ")).toEqual([MOVE]);
    expect(matchingTags(TAGS, "hip")).toEqual([]);
  });
});

describe("exact-name reuse (exactTag, newTagName)", () => {
  it("finds the tag the typed name folds to", () => {
    expect(exactTag(TAGS, "urgent")).toBe(URGENT);
    expect(exactTag(TAGS, "  care HOME  move ")).toBe(MOVE);
    expect(exactTag(TAGS, "urge")).toBeUndefined();
    expect(exactTag(TAGS, "")).toBeUndefined();
  });

  it("offers a new name only when no tag has it: tidied, valid, never a second Urgent", () => {
    expect(newTagName(TAGS, "URGENT ")).toBeNull();
    expect(newTagName(TAGS, "  Hip   pain ")).toBe("Hip pain");
    expect(newTagName(TAGS, "  ")).toBeNull();
    expect(newTagName(TAGS, "x".repeat(41))).toBeNull();
    expect(newTagName(TAGS, "x".repeat(40))).toBe("x".repeat(40));
  });
});

describe("a row's chips (chipSplit)", () => {
  it("shows two, then counts the rest", () => {
    expect(chipSplit(TAGS)).toEqual({ shown: [MOVE, KNEE], more: 1 });
    expect(chipSplit([URGENT])).toEqual({ shown: [URGENT], more: 0 });
    expect(chipSplit([])).toEqual({ shown: [], more: 0 });
  });
});

describe("a search result's chips (namedFirst)", () => {
  it("puts the tags the text names first, then the rest A to Z", () => {
    expect(namedFirst(TAGS, [URGENT.id])).toEqual([URGENT, MOVE, KNEE]);
    expect(namedFirst([URGENT, KNEE, MOVE], [URGENT.id, KNEE.id])).toEqual([KNEE, URGENT, MOVE]);
  });

  it("leaves a list with none named A to Z", () => {
    expect(namedFirst([URGENT, KNEE, MOVE], [])).toEqual([MOVE, KNEE, URGENT]);
    expect(namedFirst([URGENT, MOVE], ["not-a-tag"])).toEqual([MOVE, URGENT]);
    expect(namedFirst([], [URGENT.id])).toEqual([]);
  });
});
