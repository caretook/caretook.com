import { describe, expect, it } from "vitest";
import type { MenuSection } from "./menuModel";

import { chosenKey, normalizeMenu, SEPARATOR, sectionName } from "./menuModel";

const a = { id: "a", label: "A" };
const b = { id: "b", label: "B" };

describe("normalizeMenu", () => {
  it("keeps items in order, tagged as items", () => {
    expect(normalizeMenu([a, b])).toEqual([
      { type: "item", id: "a", label: "A" },
      { type: "item", id: "b", label: "B" },
    ]);
  });

  it("drops skipped items, at the top level and in sections", () => {
    const section: MenuSection = { type: "section", id: "s", items: [false, a, null, undefined] };
    expect(normalizeMenu([false, b, null, section])).toEqual([
      { type: "item", id: "b", label: "B" },
      { type: "section", id: "s", items: [a] },
    ]);
  });

  it("drops a section with no items, unless it has a header", () => {
    const empty: MenuSection = { type: "section", id: "e", items: [false] };
    const headed = { type: "section" as const, id: "h", header: { title: "Me" }, items: [] };
    expect(normalizeMenu([empty, a]).map((e) => e.type)).toEqual(["item"]);
    expect(normalizeMenu([headed]).map((e) => e.id)).toEqual(["h"]);
  });

  it("puts separators only between shown entries", () => {
    const empty = { type: "section" as const, id: "e", items: [] };
    const shape = (entries: Parameters<typeof normalizeMenu>[0]) =>
      normalizeMenu(entries)
        .map((e) => (e.type === "separator" ? "|" : e.id))
        .join("");
    expect(shape([SEPARATOR, a, SEPARATOR, SEPARATOR, b, SEPARATOR])).toBe("a|b");
    expect(shape([a, SEPARATOR, empty, SEPARATOR, false])).toBe("a");
    expect(shape([a, SEPARATOR, empty, SEPARATOR, b])).toBe("a|b");
  });

  it("gives separators unique ids", () => {
    const ids = normalizeMenu([a, SEPARATOR, b, SEPARATOR, { id: "c", label: "C" }])
      .filter((e) => e.type === "separator")
      .map((e) => e.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe("sectionName", () => {
  it("is the visible title, else the aria label", () => {
    expect(sectionName({ title: "Theme", ariaLabel: "x" })).toBe("Theme");
    expect(sectionName({ ariaLabel: "Switch care group" })).toBe("Switch care group");
    expect(sectionName({})).toBeUndefined();
  });
});

describe("chosenKey", () => {
  it("is the newly chosen id", () => {
    expect(chosenKey(new Set(["dark"]), "system")).toBe("dark");
  });

  it("is null for the current one, nothing, or all", () => {
    expect(chosenKey(new Set(["system"]), "system")).toBeNull();
    expect(chosenKey(new Set(), "system")).toBeNull();
    expect(chosenKey("all", "system")).toBeNull();
  });
});
