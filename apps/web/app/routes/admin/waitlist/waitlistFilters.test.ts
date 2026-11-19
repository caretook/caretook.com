import { describe, expect, it } from "vitest";
import { hasFilters, pageCount, parseWaitlistSearch, waitlistSearch } from "./waitlistFilters";

describe("parseWaitlistSearch", () => {
  it("reads every filter and the page", () => {
    expect(
      parseWaitlistSearch("?from=2026-11-01&to=2026-11-18&caringFor=parent&source=%20news%20&page=3"),
    ).toEqual({
      filter: { from: "2026-11-01", to: "2026-11-18", caringFor: "parent", source: "news" },
      page: 3,
    });
  });

  it("accepts 'none' for who they care for", () => {
    expect(parseWaitlistSearch("caringFor=none").filter).toEqual({ caringFor: "none" });
  });

  it("drops values that aren't valid", () => {
    expect(parseWaitlistSearch("?from=yesterday&to=2026-13-45&caringFor=cousin&source=&page=-1")).toEqual({
      filter: {},
      page: 1,
    });
    expect(parseWaitlistSearch("page=1.5").page).toBe(1);
  });
});

describe("waitlistSearch", () => {
  it("writes the set filters, and the page past the first", () => {
    expect(waitlistSearch({ from: "2026-11-01", source: "a&b" }, 2)).toBe(
      "?from=2026-11-01&source=a%26b&page=2",
    );
    expect(waitlistSearch({}, 1)).toBe("");
  });

  it("round-trips through parseWaitlistSearch", () => {
    const filter = { from: "2026-11-01", to: "2026-11-02", caringFor: "none" as const, source: "fall" };
    expect(parseWaitlistSearch(waitlistSearch(filter, 4))).toEqual({ filter, page: 4 });
  });
});

describe("hasFilters and pageCount", () => {
  it("say whether a filter is set and how many pages there are", () => {
    expect(hasFilters({})).toBe(false);
    expect(hasFilters({ source: "x" })).toBe(true);
    expect(pageCount(0, 50)).toBe(1);
    expect(pageCount(50, 50)).toBe(1);
    expect(pageCount(51, 50)).toBe(2);
  });
});
