import { describe, expect, it } from "vitest";
import { searchString } from "./urls";

describe("searchString", () => {
  it("encodes values", () => {
    expect(searchString({ q: "a b&c" })).toBe("?q=a+b%26c");
  });

  it("drops empty and missing values", () => {
    expect(searchString({ a: "", b: undefined, c: null, d: "1" })).toBe("?d=1");
    expect(searchString("?a=&b=2")).toBe("?b=2");
    expect(searchString(undefined)).toBe("");
  });

  it("keeps repeated parameters and their order", () => {
    expect(searchString("b=1&a=2&b=3")).toBe("?b=1&a=2&b=3");
  });
});
