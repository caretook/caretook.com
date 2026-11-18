import { describe, expect, it } from "vitest";
import { entryHeading, showTitleChips, titleState } from "./entryPage";

describe("entryHeading", () => {
  it("is the title when there is one", () => {
    expect(entryHeading("Note", "Morning", true)).toBe("Morning");
    expect(entryHeading("Event", "Physical therapy", false)).toBe("Physical therapy");
  });

  it("says New <kind> on a draft without a title", () => {
    expect(entryHeading("Note", null, true)).toBe("New note");
    expect(entryHeading("Event", "", true)).toBe("New event");
  });

  it("is the kind's label for a stored entry without a title", () => {
    expect(entryHeading("Note", null, false)).toBe("Note");
    expect(entryHeading("Note", "", false)).toBe("Note");
  });
});

describe("titleState", () => {
  const writer = { canWrite: true, deleted: false };

  it("is plain text for viewers, deleted entries and kinds without a live title", () => {
    expect(titleState({ ...writer, canWrite: false, kind: "note", title: "A", saved: true })).toEqual({
      editable: false,
    });
    expect(titleState({ ...writer, deleted: true, kind: "note", title: "A", saved: true })).toEqual({
      editable: false,
    });
    expect(titleState({ ...writer, kind: "symptom", title: "A", saved: true })).toEqual({ editable: false });
  });

  it("gives a note's title, which is optional", () => {
    expect(titleState({ ...writer, kind: "note", title: null, saved: false })).toEqual({
      editable: true,
      value: "",
      placeholder: "Title (optional)",
    });
    expect(titleState({ ...writer, kind: "note", title: "Morning", saved: true })).toMatchObject({
      value: "Morning",
    });
  });

  it("shows an unnamed event empty: Title on a draft, Add a title once saved", () => {
    expect(titleState({ ...writer, kind: "event", title: null, saved: false })).toEqual({
      editable: true,
      value: "",
      placeholder: "Title",
    });
    expect(titleState({ ...writer, kind: "event", title: "Event", saved: true })).toEqual({
      editable: true,
      value: "",
      placeholder: "Add a title",
    });
    expect(titleState({ ...writer, kind: "event", title: "Fall", saved: true })).toEqual({
      editable: true,
      value: "Fall",
      placeholder: "Title",
    });
  });
});

describe("showTitleChips", () => {
  const unnamed = { editable: true, kind: "event" as const, title: "Event", typed: "" };

  it("shows for an editable, unnamed event with nothing typed", () => {
    expect(showTitleChips(unnamed)).toBe(true);
    expect(showTitleChips({ ...unnamed, title: null })).toBe(true);
    expect(showTitleChips({ ...unnamed, typed: "  " })).toBe(true);
  });

  it("hides once something is typed, the event is named, or it isn't editable", () => {
    expect(showTitleChips({ ...unnamed, typed: "Vi" })).toBe(false);
    expect(showTitleChips({ ...unnamed, title: "Fall" })).toBe(false);
    expect(showTitleChips({ ...unnamed, editable: false })).toBe(false);
  });

  it("never shows for notes", () => {
    expect(showTitleChips({ ...unnamed, kind: "note", title: null })).toBe(false);
  });
});
