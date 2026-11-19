import { describe, expect, it } from "vitest";
import { endOfListText, nextLimit, PAGE_SIZE, pageWindow } from "./paging";

describe("nextLimit", () => {
  it("adds one page", () => {
    expect(PAGE_SIZE).toBe(30);
    expect(nextLimit(30)).toBe(60);
    expect(nextLimit(60)).toBe(90);
  });
});

describe("pageWindow", () => {
  it("shows the first page, and knows there's more from the extra row", () => {
    expect(pageWindow({ rowCount: 31, requested: 30, fresh: false })).toEqual({
      limit: 30,
      hasOlder: true,
      loading: false,
    });
    expect(pageWindow({ rowCount: 31, requested: 30, fresh: true }).loading).toBe(false);
  });

  it("reaches the end when the query returns no extra row", () => {
    expect(pageWindow({ rowCount: 30, requested: 30, fresh: true }).hasOlder).toBe(false);
    expect(pageWindow({ rowCount: 12, requested: 30, fresh: true }).hasOlder).toBe(false);
    expect(pageWindow({ rowCount: 0, requested: 30, fresh: true }).hasOlder).toBe(false);
  });

  it("keeps the previous window while a larger one loads, so nothing moves or ends early", () => {
    // Asked for 60; the 31 rows are still the 30-row query's.
    expect(pageWindow({ rowCount: 31, requested: 60, fresh: false })).toEqual({
      limit: 30,
      hasOlder: true,
      loading: true,
    });
  });

  it("shows the larger window once it arrives", () => {
    expect(pageWindow({ rowCount: 61, requested: 60, fresh: true })).toEqual({
      limit: 60,
      hasOlder: true,
      loading: false,
    });
    // 181 entries: the sixth page is the last.
    expect(pageWindow({ rowCount: 180, requested: 180, fresh: true }).hasOlder).toBe(false);
    expect(pageWindow({ rowCount: 181, requested: 180, fresh: true }).hasOlder).toBe(true);
  });
});

describe("endOfListText", () => {
  it("says it's loading while a page loads", () => {
    expect(endOfListText({ empty: false, loading: true, hasOlder: true })).toBe("Loading older…");
  });

  it("says it's the beginning once there's nothing older", () => {
    expect(endOfListText({ empty: false, loading: false, hasOlder: false })).toBe(
      "That's the beginning of the timeline",
    );
  });

  it("says nothing while there's more, or on an empty timeline (it has its own message)", () => {
    expect(endOfListText({ empty: false, loading: false, hasOlder: true })).toBe("");
    expect(endOfListText({ empty: true, loading: false, hasOlder: false })).toBe("");
  });

  it("says another list's end in its own words", () => {
    expect(
      endOfListText({ empty: false, loading: false, hasOlder: false, endText: "No earlier visits" }),
    ).toBe("No earlier visits");
  });
});
