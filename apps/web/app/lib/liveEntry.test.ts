import { describe, expect, it } from "vitest";
import {
  entryUrl,
  isLiveEntryKind,
  NEW_ENTRY,
  newEntryUrl,
  savedTitle,
  shouldMaterialize,
} from "./liveEntry";

describe("shouldMaterialize", () => {
  it("waits for a real change", () => {
    expect(shouldMaterialize({ saved: false, text: "", title: "" })).toBe(false);
    expect(shouldMaterialize({ saved: false, text: " \n ", title: "  " })).toBe(false);
  });

  it("saves on the first text in the document", () => {
    expect(shouldMaterialize({ saved: false, text: "A", title: "" })).toBe(true);
  });

  it("saves on the first title", () => {
    expect(shouldMaterialize({ saved: false, text: "", title: "Morning" })).toBe(true);
  });

  it("never saves twice", () => {
    expect(shouldMaterialize({ saved: true, text: "A", title: "Morning" })).toBe(false);
  });
});

describe("savedTitle", () => {
  it("keeps a note's title optional", () => {
    expect(savedTitle("note", "")).toBeNull();
    expect(savedTitle("note", "   ")).toBeNull();
    expect(savedTitle("note", " Morning ")).toBe("Morning");
  });
});

describe("urls and kinds", () => {
  it("builds the new and saved entry urls", () => {
    expect(newEntryUrl("g1", "note")).toBe(`/app/groups/g1/entries/${NEW_ENTRY}?kind=note`);
    expect(entryUrl("g1", "e1")).toBe("/app/groups/g1/entries/e1");
  });

  it("knows which kinds start as live documents", () => {
    expect(isLiveEntryKind("note")).toBe(true);
    expect(isLiveEntryKind("symptom")).toBe(false);
    expect(isLiveEntryKind(null)).toBe(false);
  });
});
