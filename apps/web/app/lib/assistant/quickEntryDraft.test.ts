import { describe, expect, test } from "vitest";
import { eventDraftFor, eventDraftFrom, QUICK_ENTRY_DRAFT } from "./quickEntryDraft";

const ALV = "33333333-3333-4333-8333-333333333333";

describe("the event draft", () => {
  test("round-trips through history state (structured clone included)", () => {
    const draft = eventDraftFor({
      type: "addEvent",
      title: "Dr. Elena Alvarez",
      occurredAt: "2026-11-25T08:00:00.000Z",
      allDay: true,
      place: "400 Example Ave, Springfield",
      providerIds: [ALV],
      timeZone: "America/Los_Angeles",
    });
    expect(draft).toEqual({
      kind: "event",
      title: "Dr. Elena Alvarez",
      occurredAt: "2026-11-25T08:00:00.000Z",
      allDay: true,
      place: "400 Example Ave, Springfield",
      providerIds: [ALV],
      timeZone: "America/Los_Angeles",
    });
    const state = structuredClone({ sheetOverTimeline: true, [QUICK_ENTRY_DRAFT]: draft });
    expect(eventDraftFrom(state)).toEqual(draft);
  });

  test("no place and no all day read as none", () => {
    const draft = eventDraftFor({
      type: "addEvent",
      title: "PT",
      occurredAt: "2026-11-20T17:00:00.000Z",
      providerIds: [ALV],
      timeZone: "America/Los_Angeles",
    });
    expect(draft).toMatchObject({ allDay: false, place: null });
    expect(eventDraftFrom({ [QUICK_ENTRY_DRAFT]: draft })).toEqual(draft);
  });

  test("anything else is no draft", () => {
    const good = {
      kind: "event",
      title: "PT",
      occurredAt: "2026-11-20T17:00:00.000Z",
      allDay: false,
      place: null,
      providerIds: [],
      timeZone: "America/Los_Angeles",
    };
    expect(eventDraftFrom(null)).toBeNull();
    expect(eventDraftFrom({})).toBeNull();
    expect(eventDraftFrom({ [QUICK_ENTRY_DRAFT]: { ...good, kind: "symptom" } })).toBeNull();
    expect(eventDraftFrom({ [QUICK_ENTRY_DRAFT]: { ...good, occurredAt: "soon" } })).toBeNull();
    expect(eventDraftFrom({ [QUICK_ENTRY_DRAFT]: { ...good, providerIds: [1] } })).toBeNull();
    expect(eventDraftFrom({ [QUICK_ENTRY_DRAFT]: { ...good, title: undefined } })).toBeNull();
    expect(eventDraftFrom({ [QUICK_ENTRY_DRAFT]: good })).toEqual(good);
  });
});
