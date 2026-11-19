import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetRecentSearches,
  RECENT_SEARCHES_MAX,
  recentSearches,
  recordSearch,
  withRecentSearch,
} from "./recentSearches";

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

describe("withRecentSearch", () => {
  it("puts the new search first", () => {
    expect(withRecentSearch(["knee"], "pain")).toEqual(["pain", "knee"]);
  });
  it("moves a repeat to the top, ignoring case and spacing", () => {
    expect(withRecentSearch(["knee", "Blood  pressure", "pain"], " blood pressure ")).toEqual([
      "blood pressure",
      "knee",
      "pain",
    ]);
  });
  it("keeps five", () => {
    const five = ["a", "b", "c", "d", "e"];
    expect(withRecentSearch(five, "f")).toEqual(["f", "a", "b", "c", "d"]);
    expect(withRecentSearch(five, "f")).toHaveLength(RECENT_SEARCHES_MAX);
  });
  it("ignores blank text", () => {
    expect(withRecentSearch(["knee"], "   ")).toEqual(["knee"]);
  });
});

describe("recent searches on the device", () => {
  beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("records searches newest first, without repeats, at most five", () => {
    for (const q of ["knee", "pain", "Knee", "a", "b", "c", "d"]) recordSearch("u1", q);
    expect(recentSearches("u1")).toEqual(["d", "c", "b", "a", "Knee"]);
  });

  it("keeps each user's apart", () => {
    recordSearch("u1", "knee");
    recordSearch("u2", "lisinopril");
    expect(recentSearches("u1")).toEqual(["knee"]);
    expect(recentSearches("u2")).toEqual(["lisinopril"]);
    expect(recentSearches("u3")).toEqual([]);
  });

  it("forgets every user's searches, and nothing else", () => {
    localStorage.setItem("caretook:theme", "dark");
    recordSearch("u1", "knee");
    recordSearch("u2", "pain");
    forgetRecentSearches();
    expect(recentSearches("u1")).toEqual([]);
    expect(recentSearches("u2")).toEqual([]);
    expect(localStorage.getItem("caretook:theme")).toBe("dark");
  });

  it("reads a damaged value as none", () => {
    localStorage.setItem("caretook:recentSearches:u1", "{not json");
    expect(recentSearches("u1")).toEqual([]);
    localStorage.setItem("caretook:recentSearches:u1", JSON.stringify(["ok", 3, ""]));
    expect(recentSearches("u1")).toEqual(["ok"]);
    recordSearch("u1", "knee");
    expect(recentSearches("u1")).toEqual(["knee", "ok"]);
  });

  it("has none when storage throws, and never throws itself", () => {
    vi.stubGlobal("localStorage", throwingStorage());
    expect(() => recordSearch("u1", "knee")).not.toThrow();
    expect(recentSearches("u1")).toEqual([]);
    expect(() => forgetRecentSearches()).not.toThrow();
  });
});
