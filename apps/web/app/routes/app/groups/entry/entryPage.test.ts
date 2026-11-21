import type { EventDraft } from "../../../../lib/assistant/quickEntryDraft";
import type { EntryPageData } from "./loadEntry";

import { describe, expect, it } from "vitest";
import { entryHeading, showTitleChips, titleState, withEventDraft } from "./entryPage";

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

describe("withEventDraft", () => {
  const PROVIDER = "33333333-3333-4333-8333-333333333333";
  const OTHER = "44444444-4444-4444-8444-444444444444";
  const page = (over: Partial<EntryPageData> = {}): EntryPageData => ({
    isNew: true,
    pickDay: false,
    withProviders: [],
    entry: {
      id: "e1",
      kind: "event",
      title: null,
      occurredAt: "2026-11-19T20:00:00.000Z",
      timeZone: "America/New_York",
      allDay: false,
      place: null,
    },
    heading: "New event",
    hasDocument: false,
    initial: { snapshot: null, updates: [] },
    entryRows: [],
    ...over,
  });
  const draft: EventDraft = {
    kind: "event",
    title: "Dr. Elena Alvarez",
    occurredAt: "2026-11-25T08:00:00.000Z",
    allDay: true,
    place: "400 Example Ave",
    providerIds: [PROVIDER],
    timeZone: "America/Los_Angeles",
  };

  it("fills a new event from the draft, on top of ?provider=", () => {
    const data = page({ withProviders: [OTHER] });
    const next = withEventDraft(data, draft);
    expect(next.entry).toEqual({
      id: "e1",
      kind: "event",
      title: "Dr. Elena Alvarez",
      occurredAt: "2026-11-25T08:00:00.000Z",
      timeZone: "America/Los_Angeles",
      allDay: true,
      place: "400 Example Ave",
    });
    expect(next.withProviders).toEqual([OTHER, PROVIDER]);
    expect(next.heading).toBe("Dr. Elena Alvarez");
    expect(next.entryRows).toBe(data.entryRows);
    expect(withEventDraft(page({ withProviders: [PROVIDER] }), draft).withProviders).toEqual([PROVIDER]);
  });

  it("leaves anything else as it was: no draft, a stored entry, a note", () => {
    const data = page({ withProviders: [OTHER] });
    expect(withEventDraft(data, null)).toBe(data);
    const stored = page({ isNew: false });
    expect(withEventDraft(stored, draft)).toBe(stored);
    const note = page({ entry: { ...page().entry, kind: "note" } });
    expect(withEventDraft(note, draft)).toBe(note);
  });
});
