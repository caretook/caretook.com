import { describe, expect, it } from "vitest";
import { parseUserSearch, userPageCount, userSearch } from "./userSearch";

describe("parseUserSearch", () => {
  it("reads the text and the page", () => {
    expect(parseUserSearch("?q=%20sam%20%20ex%20&page=3")).toEqual({ q: "sam ex", page: 3 });
  });

  it("treats a missing or bad page as the first", () => {
    for (const page of ["", "0", "-2", "1.5", "abc", "100001"])
      expect(parseUserSearch(`?page=${page}`).page).toBe(1);
  });

  it("caps the text", () => {
    expect(parseUserSearch(`?q=${"a".repeat(300)}`).q).toHaveLength(254);
  });
});

describe("userSearch", () => {
  it("leaves out what's empty or the default", () => {
    expect(userSearch("")).toBe("");
    expect(userSearch(" ", 1)).toBe("");
    expect(userSearch("pat@example.com", 2)).toBe("?q=pat%40example.com&page=2");
  });

  it("round-trips", () => {
    expect(parseUserSearch(userSearch("Pat Example", 4))).toEqual({ q: "Pat Example", page: 4 });
  });
});

describe("userPageCount", () => {
  it("is at least one", () => {
    expect(userPageCount(0, 50)).toBe(1);
    expect(userPageCount(50, 50)).toBe(1);
    expect(userPageCount(51, 50)).toBe(2);
  });
});
