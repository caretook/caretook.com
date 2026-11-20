import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetRecentLines, RECENT_LINES_MAX, recentLines, recordLine, withRecentLine } from "./recentLines";

/** A localStorage stand-in: a Map, with `Object.keys` listing its keys as the real one does. */
const memoryStorage = () => {
  const items: Record<string, string> = {};
  return new Proxy(
    {
      getItem: (key: string) => (key in items ? items[key]! : null),
      setItem: (key: string, value: string) => {
        items[key] = String(value);
      },
      removeItem: (key: string) => {
        delete items[key];
      },
    },
    {
      ownKeys: () => Object.keys(items),
      getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
    },
  );
};

const throwingStorage = () => {
  const fail = () => {
    throw new Error("denied");
  };
  return new Proxy({ getItem: fail, setItem: fail, removeItem: fail }, { ownKeys: fail });
};

describe("withRecentLine", () => {
  it("puts the new line first", () => {
    expect(withRecentLine(["bp 120/80"], "gave morning meds")).toEqual(["gave morning meds", "bp 120/80"]);
  });
  it("moves a repeat to the top, ignoring case and spacing", () => {
    expect(withRecentLine(["pain 4", "Gave  morning meds", "bp 120/80"], " gave morning meds ")).toEqual([
      "gave morning meds",
      "pain 4",
      "bp 120/80",
    ]);
  });
  it("keeps eight", () => {
    const eight = ["a", "b", "c", "d", "e", "f", "g", "h"];
    expect(withRecentLine(eight, "i")).toEqual(["i", "a", "b", "c", "d", "e", "f", "g"]);
    expect(withRecentLine(eight, "i")).toHaveLength(RECENT_LINES_MAX);
  });
  it("ignores blank text", () => {
    expect(withRecentLine(["pain 4"], "  \n ")).toEqual(["pain 4"]);
  });
});

describe("recent lines on the device", () => {
  beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("records lines newest first, without repeats, at most eight", () => {
    for (const line of ["pain 4", "bp 120/80", "Pain 4", "a", "b", "c", "d", "e", "f", "g"])
      recordLine("u1", "g1", line);
    expect(recentLines("u1", "g1")).toEqual(["g", "f", "e", "d", "c", "b", "a", "Pain 4"]);
  });

  it("keeps each user's and each group's apart", () => {
    recordLine("u1", "g1", "pain 4");
    recordLine("u1", "g2", "bp 120/80");
    recordLine("u2", "g1", "gave metformin");
    expect(recentLines("u1", "g1")).toEqual(["pain 4"]);
    expect(recentLines("u1", "g2")).toEqual(["bp 120/80"]);
    expect(recentLines("u2", "g1")).toEqual(["gave metformin"]);
    expect(recentLines("u2", "g2")).toEqual([]);
  });

  it("forgets every user's lines in every group, and nothing else", () => {
    localStorage.setItem("caretook:theme", "dark");
    localStorage.setItem("caretook:recentSearches:u1", JSON.stringify(["knee"]));
    recordLine("u1", "g1", "pain 4");
    recordLine("u2", "g2", "bp 120/80");
    forgetRecentLines();
    expect(recentLines("u1", "g1")).toEqual([]);
    expect(recentLines("u2", "g2")).toEqual([]);
    expect(localStorage.getItem("caretook:theme")).toBe("dark");
    expect(localStorage.getItem("caretook:recentSearches:u1")).not.toBeNull();
  });

  it("reads a damaged value as none", () => {
    localStorage.setItem("caretook:recentLines:u1:g1", "{not json");
    expect(recentLines("u1", "g1")).toEqual([]);
    localStorage.setItem("caretook:recentLines:u1:g1", JSON.stringify(["ok", 3, ""]));
    expect(recentLines("u1", "g1")).toEqual(["ok"]);
    recordLine("u1", "g1", "pain 4");
    expect(recentLines("u1", "g1")).toEqual(["pain 4", "ok"]);
  });

  it("has none when storage throws, and never throws itself", () => {
    vi.stubGlobal("localStorage", throwingStorage());
    expect(() => recordLine("u1", "g1", "pain 4")).not.toThrow();
    expect(recentLines("u1", "g1")).toEqual([]);
    expect(() => forgetRecentLines()).not.toThrow();
  });
});
