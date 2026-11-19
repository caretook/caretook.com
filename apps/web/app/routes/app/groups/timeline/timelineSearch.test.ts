import { describe, expect, it } from "vitest";
import { NO_MATCH, searchAnnouncement, searchStateText, timelineSearch } from "./timelineSearch";

const GROUP = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

describe("timelineSearch", () => {
  it("no text is no search", () => {
    expect(timelineSearch(GROUP, "", "ready")).toEqual({ state: "none", match: null });
    expect(timelineSearch(GROUP, "", "preparing")).toEqual({ state: "none", match: null });
  });

  it("matches entries of the group through the index", () => {
    const { state, match } = timelineSearch(GROUP, "walk", "ready");
    expect(state).toBe("ready");
    expect(match?.sql).toMatch(/^timeline_entry\.id IN \(SELECT i\.item_id FROM search_fts/);
    expect(match?.sql).toContain("i.item_type = 'entry'");
    expect(match?.params[1]).toBe(GROUP);
    expect(String(match?.params[0])).toContain("walk");
  });

  it("only exclusions match nothing", () => {
    expect(timelineSearch(GROUP, "-pain", "ready")).toEqual({ state: "empty", match: NO_MATCH });
  });

  it("matches nothing while the index is preparing or unavailable", () => {
    expect(timelineSearch(GROUP, "walk", "preparing")).toEqual({ state: "preparing", match: NO_MATCH });
    expect(timelineSearch(GROUP, "walk", "unavailable")).toEqual({ state: "unavailable", match: NO_MATCH });
  });
});

describe("searchStateText", () => {
  it("says why nothing shows", () => {
    expect(searchStateText("preparing")).toBe("Preparing search…");
    expect(searchStateText("unavailable")).toBe("Search isn't available on this device.");
    expect(searchStateText("empty")).toMatch(/exclusions alone/);
    expect(searchStateText("ready")).toBeNull();
    expect(searchStateText("none")).toBeNull();
  });
});

describe("searchAnnouncement", () => {
  const base = {
    q: "walk",
    state: "ready",
    shown: 0,
    hasOlder: false,
    emptyText: "No entries match “walk”.",
  } as const;

  it("says nothing without a search", () => {
    expect(searchAnnouncement({ ...base, q: "", state: "none" })).toBeNull();
  });

  it("counts the matches shown, with + while older ones are to load", () => {
    expect(searchAnnouncement({ ...base, shown: 1 })).toBe("1 entry matches “walk”.");
    expect(searchAnnouncement({ ...base, shown: 12 })).toBe("12 entries match “walk”.");
    expect(searchAnnouncement({ ...base, shown: 30, hasOlder: true })).toBe("30+ entries match “walk”.");
  });

  it("says the empty text, or why nothing shows", () => {
    expect(searchAnnouncement(base)).toBe("No entries match “walk”.");
    expect(searchAnnouncement({ ...base, state: "preparing" })).toBe("Preparing search…");
  });
});
