import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_UNITS, parseQuickEntry } from "@caretook/data/schema";
import {
  forgetRecentLines,
  RECENT_LINES_MAX,
  recentLineFor,
  recentLines,
  recordLine,
  reduceRecentLines,
  withRecentLine,
} from "./recentLines";

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
    expect(withRecentLine(["pain 4", "Gave  morning meds", "bp 120/80"], " gave morning meds")).toEqual([
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
  it("keeps the trailing space of a keys-only line, and treats it as the same line as without", () => {
    expect(withRecentLine(["pain 4"], "bp hr ")).toEqual(["bp hr ", "pain 4"]);
    expect(withRecentLine(["bp hr ", "pain 4"], "bp hr")).toEqual(["bp hr", "pain 4"]);
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

const parsed = (line: string) =>
  parseQuickEntry(line, {
    now: new Date("2026-11-19T16:00:00Z"),
    timeZone: "America/Los_Angeles",
    units: DEFAULT_UNITS,
    medications: [],
    providers: [],
    passes: [],
    members: [],
  }).parts;
const reduced = (line: string) => recentLineFor(line, parsed(line));

describe("recentLineFor", () => {
  it("remembers nothing for a note or an event", () => {
    expect(reduced("n: slept well")).toBe("");
    expect(reduced("appt Dr Lee Friday 2pm")).toBe("");
  });
  it("keeps a vital line's keys only, in order", () => {
    expect(reduced("bp 130/85 hr 72")).toBe("bp hr ");
  });
  it("keeps any other line as typed", () => {
    expect(reduced("pain 4 left knee")).toBe("pain 4 left knee");
  });
  it("reduces the vitals of a mixed line and drops its notes", () => {
    expect(reduced("bp 120/80, n: tired")).toBe("bp ");
    expect(reduced("bp 120/80, pain 4 left knee, n: tired")).toBe("bp, pain 4 left knee ");
  });
  it("reduces lines stored earlier as they're read", () => {
    expect(reduceRecentLines(["n: slept well", "bp 130/85 hr 72", "pain 4 left knee"], parsed)).toEqual([
      "bp hr ",
      "pain 4 left knee",
    ]);
    // Lines reduced already are left as they are.
    expect(reduceRecentLines(["bp hr ", "bp, pain 4 left knee "], parsed)).toEqual([
      "bp hr ",
      "bp, pain 4 left knee ",
    ]);
  });
});
