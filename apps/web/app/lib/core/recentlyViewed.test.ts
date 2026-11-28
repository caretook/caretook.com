import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetRecentlyViewed,
  RECENTLY_VIEWED_MAX,
  recentlyViewed,
  recordView,
  withViewed,
} from "./recentlyViewed";

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

const provider = (id: string) => ({ type: "provider" as const, id });

describe("withViewed", () => {
  it("puts the new record first", () => {
    expect(withViewed([provider("a")], { type: "note", id: "n" })).toEqual([
      { type: "note", id: "n" },
      provider("a"),
    ]);
  });
  it("moves a repeat to the top; the same id as another type is another record", () => {
    const recent = [provider("a"), provider("b"), { type: "medication" as const, id: "b" }];
    expect(withViewed(recent, provider("b"))).toEqual([
      provider("b"),
      provider("a"),
      { type: "medication", id: "b" },
    ]);
  });
  it("keeps ten", () => {
    const ten = Array.from({ length: 10 }, (_, i) => provider(`p${i}`));
    const next = withViewed(ten, provider("new"));
    expect(next).toHaveLength(RECENTLY_VIEWED_MAX);
    expect(next[0]).toEqual(provider("new"));
    expect(next.at(-1)).toEqual(provider("p8"));
  });
});

describe("recently viewed on the device", () => {
  beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("records views newest first, distinct, at most ten", () => {
    for (let i = 0; i < 12; i++) recordView("u1", provider(`p${i}`));
    recordView("u1", provider("p5"));
    const ids = recentlyViewed("u1").map((r) => r.id);
    expect(ids).toEqual(["p5", "p11", "p10", "p9", "p8", "p7", "p6", "p4", "p3", "p2"]);
  });

  it("keeps the four types", () => {
    recordView("u1", provider("p"));
    recordView("u1", { type: "medication", id: "m" });
    recordView("u1", { type: "note", id: "n" });
    recordView("u1", { type: "event", id: "e" });
    expect(recentlyViewed("u1").map((r) => r.type)).toEqual(["event", "note", "medication", "provider"]);
  });

  it("keeps each user's apart", () => {
    recordView("u1", provider("a"));
    recordView("u2", provider("b"));
    expect(recentlyViewed("u1")).toEqual([provider("a")]);
    expect(recentlyViewed("u2")).toEqual([provider("b")]);
    expect(recentlyViewed("u3")).toEqual([]);
  });

  it("forgets every user's records, and nothing else", () => {
    localStorage.setItem("caretook:theme", "dark");
    recordView("u1", provider("a"));
    recordView("u2", provider("b"));
    forgetRecentlyViewed();
    expect(recentlyViewed("u1")).toEqual([]);
    expect(recentlyViewed("u2")).toEqual([]);
    expect(localStorage.getItem("caretook:theme")).toBe("dark");
  });

  it("reads a damaged value as none, and drops damaged items", () => {
    localStorage.setItem("caretook:recentlyViewed:u1", "{not json");
    expect(recentlyViewed("u1")).toEqual([]);
    localStorage.setItem(
      "caretook:recentlyViewed:u1",
      JSON.stringify([provider("ok"), { type: "todo", id: "t" }, { type: "note" }, "x", null]),
    );
    expect(recentlyViewed("u1")).toEqual([provider("ok")]);
    recordView("u1", provider("a"));
    expect(recentlyViewed("u1")).toEqual([provider("a"), provider("ok")]);
  });

  it("has none when storage throws, and never throws itself", () => {
    vi.stubGlobal("localStorage", throwingStorage());
    expect(() => recordView("u1", provider("a"))).not.toThrow();
    expect(recentlyViewed("u1")).toEqual([]);
    expect(() => forgetRecentlyViewed()).not.toThrow();
  });
});
