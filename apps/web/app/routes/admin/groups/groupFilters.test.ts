import { describe, expect, it } from "vitest";
import { groupPageCount, groupSearch, hasGroupFilters, parseGroupSearch } from "./groupFilters";

describe("parseGroupSearch", () => {
  it("reads the search, the no-owner filter and the page", () => {
    expect(parseGroupSearch("?q=%20Grandma%20%20Pat%20&noOwner=1&page=3")).toEqual({
      filter: { q: "Grandma Pat", noOwner: true },
      page: 3,
    });
    expect(parseGroupSearch("?noOwner=on")).toEqual({ filter: { noOwner: true }, page: 1 });
  });

  it("drops what isn't valid", () => {
    expect(parseGroupSearch("?q=%20%20&noOwner=0&page=-2")).toEqual({ filter: {}, page: 1 });
    expect(parseGroupSearch("?page=1.5").page).toBe(1);
    expect(parseGroupSearch(`?q=${"a".repeat(300)}`).filter.q).toHaveLength(120);
  });
});

describe("groupSearch", () => {
  it("round-trips and leaves out page 1 and empty filters", () => {
    const filter = { q: "Lou & co", noOwner: true };
    expect(parseGroupSearch(groupSearch(filter, 2))).toEqual({ filter, page: 2 });
    expect(groupSearch({}, 1)).toBe("");
    expect(groupSearch({ q: "Pat" })).toBe("?q=Pat");
  });
});

describe("hasGroupFilters and groupPageCount", () => {
  it("say whether anything filters and how many pages there are", () => {
    expect(hasGroupFilters({})).toBe(false);
    expect(hasGroupFilters({ noOwner: true })).toBe(true);
    expect(groupPageCount(0, 50)).toBe(1);
    expect(groupPageCount(101, 50)).toBe(3);
  });
});
