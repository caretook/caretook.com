import type { CalendarEntryInput, CalendarTodoInput } from "./calendarItems";

import { describe, expect, it } from "vitest";
import { CALENDAR_WINDOW_DAYS, calendarItems, calendarWindow } from "./calendarItems";

// calendarItems (appointments-2): one group's appointments, reminders and
// open todos as neutral items, on the appointments area's clock (Wed
// 2026-11-18 10:00 in Los Angeles). Names and data are made up.

const NOW = new Date("2026-11-18T18:00:00.000Z");
const LA = "America/Los_Angeles";
const GROUP = "0b7a4c2e-0000-4000-8000-000000000001";
const APP = "https://caretook.example/";
const PAT = { displayName: "Pat", timeZone: LA };
const { from, to } = calendarWindow(NOW);

let n = 0;
const nextId = () => `0b7a4c2e-0000-4000-8000-${String(++n).padStart(12, "0")}`;

const entry = (v: Partial<CalendarEntryInput> = {}): CalendarEntryInput => ({
  id: nextId(),
  groupId: GROUP,
  kind: "event",
  occurredAt: "2026-11-20T17:00:00.000Z",
  timeZone: LA,
  endsAt: null,
  allDay: false,
  title: "Dialysis",
  place: "Riverside Clinic",
  cancelledAt: null,
  deletedAt: null,
  createdAt: "2026-11-10T18:00:00.000Z",
  seriesId: null,
  seriesDay: null,
  seriesDetached: false,
  ...v,
});

const todo = (v: Partial<CalendarTodoInput> = {}): CalendarTodoInput => ({
  id: nextId(),
  groupId: GROUP,
  title: "Pick up the walker",
  dueOn: "2026-11-19",
  dueTime: null,
  doneAt: null,
  deletedAt: null,
  ...v,
});

const items = (entries: CalendarEntryInput[], todos: CalendarTodoInput[] = [], window = { from, to }) =>
  calendarItems({ entries, todos, recipient: PAT, ...window, appUrl: APP });

describe("calendarWindow", () => {
  it("runs 90 days back to 90 days ahead of now", () => {
    expect(CALENDAR_WINDOW_DAYS).toBe(90);
    expect(from.toISOString()).toBe("2026-08-20T18:00:00.000Z");
    expect(to.toISOString()).toBe("2027-02-16T18:00:00.000Z");
  });
});

describe("calendarItems", () => {
  it("makes an appointment of an event, with its end, place, providers and link", () => {
    const e = entry({ endsAt: "2026-11-20T18:30:00.000Z", providers: ["Dr. Rivera"] });
    expect(items([e])).toEqual([
      {
        uid: `entry:${e.id}`,
        source: { type: "entry", id: e.id },
        groupId: GROUP,
        kind: "appointment",
        allDay: false,
        start: "2026-11-20T17:00:00.000Z",
        end: "2026-11-20T18:30:00.000Z",
        timeZone: LA,
        status: "confirmed",
        recipientName: "Pat",
        title: "Dialysis",
        place: "Riverside Clinic",
        providers: ["Dr. Rivera"],
        series: null,
        appUrl: `https://caretook.example/app/groups/${GROUP}/entries/${e.id}`,
      },
    ]);
  });

  it("gives an appointment without an end an hour, and a reminder half an hour", () => {
    const appointment = entry();
    const reminder = entry({
      kind: "note",
      title: "Call the pharmacy",
      occurredAt: "2026-11-19T16:00:00.000Z",
    });
    const [first, second] = items([appointment, reminder]);
    expect(first).toMatchObject({ kind: "reminder", end: "2026-11-19T16:30:00.000Z", place: null });
    expect(second).toMatchObject({ kind: "appointment", end: "2026-11-20T18:00:00.000Z" });
  });

  it("keeps cancelled appointments, marked cancelled, and leaves deleted entries out", () => {
    const cancelled = entry({ cancelledAt: "2026-11-17T18:00:00.000Z" });
    const deleted = entry({ deletedAt: "2026-11-17T18:00:00.000Z" });
    expect(items([cancelled, deleted]).map((i) => [i.source.id, i.status])).toEqual([
      [cancelled.id, "cancelled"],
    ]);
  });

  it("takes a note only when it's a reminder: written before it's due, or a series visit", () => {
    const planned = entry({ kind: "note", occurredAt: "2026-11-19T16:00:00.000Z" });
    const logged = entry({
      kind: "note",
      occurredAt: "2026-11-17T16:00:00.000Z",
      createdAt: "2026-11-17T16:00:30.000Z",
    });
    const visit = entry({
      kind: "note",
      occurredAt: "2026-11-01T16:00:00.000Z",
      createdAt: "2026-11-02T16:00:00.000Z",
      seriesId: "0b7a4c2e-0000-4000-8000-0000000000aa",
      seriesDay: "2026-11-01",
    });
    // An all-day note written that morning is still that day's reminder.
    const today = entry({
      kind: "note",
      allDay: true,
      occurredAt: "2026-11-18T08:00:00.000Z",
      createdAt: "2026-11-18T17:00:00.000Z",
    });
    const symptom = entry({ kind: "symptom", occurredAt: "2026-11-17T16:00:00.000Z" });
    expect(items([planned, logged, visit, today, symptom]).map((i) => i.source.id)).toEqual([
      visit.id,
      today.id,
      planned.id,
    ]);
  });

  it("flags series visits with their series, day and whether they were changed alone", () => {
    const seriesId = "0b7a4c2e-0000-4000-8000-0000000000bb";
    const visit = entry({ seriesId, seriesDay: "2026-11-20", seriesDetached: true });
    expect(items([visit])[0]!.series).toEqual({ id: seriesId, day: "2026-11-20", detached: true });
  });

  it("makes all-day items day spans in the entry's own zone", () => {
    // Midnight in Tokyo is still the 19th in Los Angeles: the entry's zone decides the day.
    const tokyo = entry({ allDay: true, occurredAt: "2026-11-19T15:00:00.000Z", timeZone: "Asia/Tokyo" });
    const la = entry({ allDay: true, occurredAt: "2026-11-21T08:00:00.000Z" });
    expect(items([tokyo, la]).map((i) => [i.allDay, i.start, i.end, i.timeZone])).toEqual([
      [true, "2026-11-20", "2026-11-21", "Asia/Tokyo"],
      [true, "2026-11-21", "2026-11-22", LA],
    ]);
  });

  it("takes open todos with a due day, timed in the recipient's zone, across a DST change", () => {
    const allDay = todo({ dueOn: "2026-11-19" });
    // 1 Nov 2026: Los Angeles falls back at 2:00, so 9:00 is UTC−8.
    const timed = todo({ dueOn: "2026-11-01", dueTime: "09:00" });
    const summer = todo({ dueOn: "2026-10-31", dueTime: "09:00" });
    const result = items([], [allDay, timed, summer]);
    expect(result.map((i) => [i.kind, i.allDay, i.start, i.end])).toEqual([
      ["todo", false, "2026-10-31T16:00:00.000Z", "2026-10-31T16:30:00.000Z"],
      ["todo", false, "2026-11-01T17:00:00.000Z", "2026-11-01T17:30:00.000Z"],
      ["todo", true, "2026-11-19", "2026-11-20"],
    ]);
    expect(result[2]).toMatchObject({
      uid: `todo:${allDay.id}`,
      timeZone: LA,
      title: "Pick up the walker",
      appUrl: `https://caretook.example/app/groups/${GROUP}/tasks/${allDay.id}`,
    });
  });

  it("leaves out done, deleted and undated todos", () => {
    const done = todo({ doneAt: "2026-11-18T17:00:00.000Z" });
    const deleted = todo({ deletedAt: "2026-11-18T17:00:00.000Z" });
    const undated = todo({ dueOn: null });
    expect(items([], [done, deleted, undated])).toEqual([]);
  });

  it("keeps what overlaps the window and drops what's wholly outside it", () => {
    const window = { from: new Date("2026-11-18T08:00:00.000Z"), to: new Date("2026-11-19T08:00:00.000Z") };
    const endsAtFrom = entry({ occurredAt: "2026-11-18T07:00:00.000Z", endsAt: "2026-11-18T08:00:00.000Z" });
    const overlapsFrom = entry({
      occurredAt: "2026-11-18T07:00:00.000Z",
      endsAt: "2026-11-18T08:01:00.000Z",
    });
    const startsAtTo = entry({ occurredAt: "2026-11-19T08:00:00.000Z" });
    const lastMinute = entry({ occurredAt: "2026-11-19T07:59:00.000Z" });
    // The 18th in Los Angeles is exactly the window; the 19th starts at its end.
    const today = todo({ dueOn: "2026-11-18" });
    const tomorrow = todo({ dueOn: "2026-11-19" });
    expect(
      items([endsAtFrom, overlapsFrom, startsAtTo, lastMinute], [today, tomorrow], window).map(
        (i) => i.source.id,
      ),
    ).toEqual([overlapsFrom.id, today.id, lastMinute.id]);
  });

  it("covers the default window's edges: 90 days back and ahead", () => {
    const tooOld = entry({ occurredAt: "2026-08-20T16:00:00.000Z" });
    const oldest = entry({ occurredAt: "2026-08-20T18:00:00.000Z" });
    const furthest = entry({ occurredAt: "2027-02-16T17:59:00.000Z" });
    const tooFar = entry({ occurredAt: "2027-02-16T18:00:00.000Z" });
    expect(items([tooOld, oldest, furthest, tooFar]).map((i) => i.source.id)).toEqual([
      oldest.id,
      furthest.id,
    ]);
  });

  it("orders by start, then uid", () => {
    const later = entry({ occurredAt: "2026-11-21T17:00:00.000Z" });
    const sooner = entry({ occurredAt: "2026-11-19T17:00:00.000Z" });
    expect(items([later, sooner]).map((i) => i.source.id)).toEqual([sooner.id, later.id]);
  });

  it("drops a blank title and place", () => {
    expect(items([entry({ title: "  ", place: "" })])[0]).toMatchObject({ title: null, place: null });
  });
});
