import { describe, expect, it } from "vitest";
import {
  DEFAULT_EVENT_TITLE,
  entryUrl,
  isLiveEntryKind,
  isUnnamedEvent,
  NEW_ENTRY,
  newEntryUrl,
  savedTitle,
  shouldMaterialize,
  titleField,
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

  it('saves an unnamed event as "Event"', () => {
    expect(DEFAULT_EVENT_TITLE).toBe("Event");
    expect(savedTitle("event", "")).toBe("Event");
    expect(savedTitle("event", "   ")).toBe("Event");
    expect(savedTitle("event", " Physical therapy ")).toBe("Physical therapy");
  });
});

describe("unnamed events", () => {
  it("are events with no title, or the default one", () => {
    expect(isUnnamedEvent("event", null)).toBe(true);
    expect(isUnnamedEvent("event", "")).toBe(true);
    expect(isUnnamedEvent("event", "Event")).toBe(true);
    expect(isUnnamedEvent("event", "Dr. Patel")).toBe(false);
    expect(isUnnamedEvent("note", null)).toBe(false);
  });

  it("show an empty title field, prompting for a name once saved", () => {
    expect(titleField("event", null, false)).toEqual({ value: "", placeholder: "Title" });
    expect(titleField("event", "Event", true)).toEqual({
      value: "",
      placeholder: "Add a title",
    });
    expect(titleField("event", "Dr. Patel", true)).toMatchObject({ value: "Dr. Patel" });
  });

  it("leave a note's optional title alone", () => {
    expect(titleField("note", null, true)).toEqual({
      value: "",
      placeholder: "Title (optional)",
    });
    expect(titleField("note", "Event", true)).toMatchObject({ value: "Event" });
  });
});

describe("urls and kinds", () => {
  it("builds the new and saved entry urls", () => {
    expect(newEntryUrl("g1", "note")).toBe(`/app/groups/g1/entries/${NEW_ENTRY}?kind=note`);
    expect(newEntryUrl("g1", "event")).toBe(`/app/groups/g1/entries/${NEW_ENTRY}?kind=event`);
    expect(entryUrl("g1", "e1")).toBe("/app/groups/g1/entries/e1");
  });

  it("knows which kinds start as live documents", () => {
    expect(isLiveEntryKind("note")).toBe(true);
    expect(isLiveEntryKind("event")).toBe(true);
    expect(isLiveEntryKind("symptom")).toBe(false);
    expect(isLiveEntryKind(null)).toBe(false);
  });
});
