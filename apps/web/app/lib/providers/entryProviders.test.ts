import { describe, expect, it } from "vitest";
import { chipLabel, groupLinksByEntry, withSummary, withText } from "./entryProviders";

const patel = { id: "p1", name: "Dr. Samuel Patel", deletedAt: null };
const lee = { id: "p2", name: "Dr. Ana Lee", deletedAt: null };
const gone = { id: "p3", name: "Dr. Gone", deletedAt: "2026-11-01T00:00:00.000Z" };

describe("chipLabel", () => {
  it("marks a deleted provider removed", () => {
    expect(chipLabel(patel)).toBe("Dr. Samuel Patel");
    expect(chipLabel(gone)).toBe("Dr. Gone (removed)");
  });
});

describe("withSummary", () => {
  it("shows up to two names, then counts the rest", () => {
    expect(withSummary([])).toEqual({ names: [], more: 0 });
    expect(withSummary([patel])).toEqual({ names: [patel], more: 0 });
    expect(withSummary([patel, lee])).toEqual({ names: [patel, lee], more: 0 });
    expect(withSummary([patel, lee, gone])).toEqual({ names: [patel, lee], more: 1 });
  });
});

describe("withText", () => {
  it("reads the line as a sentence", () => {
    expect(withText([])).toBe("");
    expect(withText([patel])).toBe("with Dr. Samuel Patel");
    expect(withText([gone, patel])).toBe("with Dr. Gone (removed), Dr. Samuel Patel");
    expect(withText([patel, lee, gone])).toBe("with Dr. Samuel Patel, Dr. Ana Lee and 1 more");
  });
});

describe("groupLinksByEntry", () => {
  it("groups rows by entry in their order, skipping nameless ones", () => {
    const byEntry = groupLinksByEntry(
      [
        { entry_id: "e1", provider_id: "p1", name: "Dr. Samuel Patel", deleted_at: null },
        { entry_id: "e2", provider_id: "p2", name: "Dr. Ana Lee", deleted_at: null },
        { entry_id: "e1", provider_id: "p3", name: "Dr. Gone", deleted_at: "2026-11-01 00:00:00Z" },
        { entry_id: "e1", provider_id: "p4", name: null, deleted_at: null },
      ],
      (v) => `iso:${v}`,
    );
    expect(byEntry.get("e1")).toEqual([
      patel,
      { id: "p3", name: "Dr. Gone", deletedAt: "iso:2026-11-01 00:00:00Z" },
    ]);
    expect(byEntry.get("e2")).toEqual([lee]);
    expect(byEntry.get("e3")).toBeUndefined();
  });
});
