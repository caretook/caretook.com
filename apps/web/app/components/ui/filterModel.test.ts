import { describe, expect, it, vi } from "vitest";
import type { FilterSection } from "./filterModel";
import type { MenuSection } from "./menuModel";

import {
  CLEAR_FILTERS_ID,
  filterButtonName,
  filterChips,
  filterCount,
  filterMenuEntries,
} from "./filterModel";
import { SEPARATOR } from "./menuModel";

// A medications-like list: Status and Type, each "all" by default. Searches are plain strings.
const status = (current: string): FilterSection => ({
  id: "status",
  title: "Status",
  current,
  defaultId: "all",
  options: [
    { id: "all", label: "All", search: "?q=met" },
    { id: "current", label: "Current", search: "?q=met&status=current" },
    { id: "completed", label: "Completed", search: "?q=met&status=completed" },
  ],
});
const type = (current: string, chipLabel?: string): FilterSection => ({
  id: "type",
  title: "Type",
  current,
  defaultId: "all",
  chipLabel,
  options: [
    { id: "all", label: "All types", search: "?q=met&status=current" },
    { id: "otc", label: "Over the counter", search: "?q=met&status=current&type=otc" },
  ],
});
const CLEAR = "?q=met";

describe("filterCount and filterButtonName", () => {
  it("counts the sections off their default", () => {
    expect(filterCount([status("all"), type("all")])).toBe(0);
    expect(filterCount([status("current"), type("all")])).toBe(1);
    expect(filterCount([status("current"), type("otc")])).toBe(2);
  });

  it("reads a current that isn't an option as the default", () => {
    expect(filterCount([status("bogus")])).toBe(0);
    expect(filterChips([status("bogus")])).toEqual([]);
  });

  it("names the button Filter, or Filter, N on", () => {
    expect(filterButtonName(0)).toBe("Filter");
    expect(filterButtonName(2)).toBe("Filter, 2 on");
  });
});

describe("filterChips", () => {
  it("makes no chip for a section on its default", () => {
    expect(filterChips([status("all"), type("all")])).toEqual([]);
  });

  it("makes a chip per section off its default, in section order, clearing to that section's default search", () => {
    expect(filterChips([status("current"), type("otc")])).toEqual([
      {
        id: "status",
        label: "Current",
        name: "Current: clear this filter",
        to: { search: "?q=met" },
        current: true,
      },
      {
        id: "type",
        label: "Over the counter",
        name: "Over the counter: clear this filter",
        to: { search: "?q=met&status=current" },
        current: true,
      },
    ]);
  });

  it("uses the section's chipLabel when given", () => {
    const [chip] = filterChips([type("otc", "OTC")]);
    expect(chip).toMatchObject({ label: "OTC", name: "OTC: clear this filter" });
  });

  it("appends the extra chips, not counted, with a default or given name", () => {
    const sections = [status("current")];
    const chips = filterChips(sections, [
      { id: "author", label: "By Ann", search: "?status=current" },
      { id: "other", label: "Other", search: "", name: "Other: clear it" },
    ]);
    expect(chips.map((c) => [c.id, c.name, c.to])).toEqual([
      ["status", "Current: clear this filter", { search: "?q=met" }],
      ["author", "By Ann: clear this filter", { search: "?status=current" }],
      ["other", "Other: clear it", { search: "" }],
    ]);
    expect(filterCount(sections)).toBe(1);
  });
});

describe("filterMenuEntries", () => {
  const sectionsOf = (entries: ReturnType<typeof filterMenuEntries>) =>
    entries.filter((e): e is MenuSection => !!e && "type" in e && e.type === "section");

  it("has a titled single-selection section per filter, the current option selected", () => {
    const entries = filterMenuEntries([status("current"), type("all")], CLEAR, () => undefined);
    const sections = sectionsOf(entries);
    expect(sections.map((s) => [s.id, s.title, s.selection?.selected])).toEqual([
      ["status", "Status", "status:current"],
      ["type", "Type", "type:all"],
    ]);
    expect(sections[1]!.items).toEqual([
      { id: "type:all", label: "All types" },
      { id: "type:otc", label: "Over the counter" },
    ]);
  });

  it("goes to an option's search when it's chosen", () => {
    const go = vi.fn();
    const [first] = sectionsOf(filterMenuEntries([status("all")], CLEAR, go));
    first!.selection!.onChange("status:completed");
    expect(go).toHaveBeenCalledWith("?q=met&status=completed");
  });

  it("has no Clear filters with nothing on", () => {
    const entries = filterMenuEntries([status("all"), type("all")], CLEAR, () => undefined);
    expect(entries).toHaveLength(2);
    expect(entries).not.toContain(SEPARATOR);
  });

  it("ends with a separator and Clear filters (to the clear search) while any filter is on", () => {
    const go = vi.fn();
    const entries = filterMenuEntries([status("all"), type("otc")], CLEAR, go);
    expect(entries).toHaveLength(4);
    expect(entries[2]).toBe(SEPARATOR);
    const clear = entries[3] as { id: string; label: string; onAction: () => void };
    expect([clear.id, clear.label]).toEqual([CLEAR_FILTERS_ID, "Clear filters"]);
    clear.onAction();
    expect(go).toHaveBeenCalledWith(CLEAR);
  });
});
