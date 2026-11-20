import { describe, expect, it } from "vitest";
import {
  parseSuppressionSearch,
  suppressionPageCount,
  suppressionReasonLabel,
  suppressionSearch,
} from "./suppressionSearch";

describe("parseSuppressionSearch", () => {
  it("reads the text and page", () => {
    expect(parseSuppressionSearch("?q=pat%40example.com&page=3")).toEqual({ q: "pat@example.com", page: 3 });
  });

  it("drops spaces (addresses have none) and caps the length", () => {
    expect(parseSuppressionSearch("?q=+pat+@example.com+").q).toBe("pat@example.com");
    expect(parseSuppressionSearch(`?q=${"a".repeat(300)}`).q).toHaveLength(254);
  });

  it("takes any page that isn't a positive whole number as the first", () => {
    for (const page of ["", "0", "-2", "1.5", "x", "100001"])
      expect(parseSuppressionSearch(`?page=${page}`).page).toBe(1);
  });
});

describe("suppressionSearch", () => {
  it("leaves out what's empty or the first page", () => {
    expect(suppressionSearch("")).toBe("");
    expect(suppressionSearch(" ", 1)).toBe("");
    expect(suppressionSearch("pat", 2)).toBe("?q=pat&page=2");
  });

  it("round-trips", () => {
    expect(parseSuppressionSearch(suppressionSearch("pat@example.com", 4))).toEqual({
      q: "pat@example.com",
      page: 4,
    });
  });
});

describe("suppressionPageCount", () => {
  it("is at least one page", () => {
    expect(suppressionPageCount(0, 50)).toBe(1);
    expect(suppressionPageCount(51, 50)).toBe(2);
  });
});

describe("suppressionReasonLabel", () => {
  it("names each reason", () => {
    expect(suppressionReasonLabel("bounce")).toBe("Hard bounce");
    expect(suppressionReasonLabel("complaint")).toBe("Marked as spam");
    expect(suppressionReasonLabel("other")).toBe("other");
  });
});
