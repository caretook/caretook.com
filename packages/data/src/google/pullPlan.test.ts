import type { CalendarItem } from "../db/schema";
import type { GoogleEvent } from "./client";
import type { PullLink } from "./pullPlan";

import { describe, expect, it } from "vitest";
import { UID_PROPERTY } from "./client";
import { interpretGoogleChange, UNTITLED_APPOINTMENT } from "./pullPlan";

// interpretGoogleChange (appointments-2, slice 9): one action per change
// pulled from a member's Google calendar, for each role. The appointments
// clock: Wed 2026-11-18 10:00 in Los Angeles (18:00 UTC). Names are made up.

const NOW = new Date("2026-11-18T18:00:00.000Z");
const LA = "America/Los_Angeles";
const ROLES = ["owner", "admin", "caretaker", "viewer"] as const;
const WRITERS = ["owner", "admin", "caretaker"] as const;

const item = (over: Partial<CalendarItem> = {}): CalendarItem => ({
  uid: "entry:e1",
  source: { type: "entry", id: "e1" },
  groupId: "g1",
  kind: "appointment",
  allDay: false,
  // Thu 19 Nov, 9:00–10:00 in Los Angeles.
  start: "2026-11-19T17:00:00.000Z",
  end: "2026-11-19T18:00:00.000Z",
  timeZone: LA,
  status: "confirmed",
  recipientName: "Pat Example",
  title: "Dialysis",
  place: null,
  providers: [],
  series: null,
  appUrl: "http://localhost:5173/app/groups/g1/entries/e1",
  ...over,
});

const todo = (over: Partial<CalendarItem> = {}) =>
  item({
    uid: "todo:t1",
    source: { type: "todo", id: "t1" },
    kind: "todo",
    end: "2026-11-19T17:30:00.000Z",
    ...over,
  });

const linkFor = (it: CalendarItem, etag = '"etag-1"'): PullLink => ({
  itemUid: it.uid,
  googleEventId: `ev-${it.source.id}`,
  etag,
});

/** Google's copy of an item, changed by `over` (a new etag unless given). */
const eventFor = (it: CalendarItem, over: Partial<GoogleEvent> = {}): GoogleEvent => ({
  id: `ev-${it.source.id}`,
  etag: '"etag-2"',
  status: "confirmed",
  summary: "Appointment for Pat Example",
  description: null,
  location: null,
  start: it.allDay ? { date: it.start } : { dateTime: it.start, timeZone: LA },
  end: it.allDay ? { date: it.end } : { dateTime: it.end, timeZone: LA },
  privateProperties: { [UID_PROPERTY]: it.uid },
  updated: "2026-11-18T17:59:00.000Z",
  recurring: false,
  ...over,
});

const moved = { start: { dateTime: "2026-11-19T19:00:00.000Z", timeZone: LA } } as const;
const movedEnd = { end: { dateTime: "2026-11-19T20:30:00.000Z", timeZone: LA } } as const;

const run = (args: {
  change: GoogleEvent;
  link: PullLink | null;
  item: CalendarItem | null;
  role: (typeof ROLES)[number];
}) => interpretGoogleChange({ ...args, now: NOW, timeZone: LA });

describe("echoes and no-ops", () => {
  it.each(ROLES)("ignores our own push (the etag we stored), as %s", (role) => {
    const it_ = item();
    const change = eventFor(it_, { etag: '"etag-1"', ...moved });
    expect(run({ change, link: linkFor(it_), item: it_, role })).toEqual({ type: "ignore", reason: "echo" });
  });

  it.each(ROLES)("ignores an event whose times are already the item's, as %s", (role) => {
    const it_ = item();
    const change = eventFor(it_, { summary: "Renamed in Google" });
    expect(run({ change, link: linkFor(it_), item: it_, role })).toEqual({
      type: "ignore",
      reason: "unchanged",
    });
  });

  it("ignores a todo's end alone (its end is made up)", () => {
    for (const it_ of [todo()]) {
      const change = eventFor(it_, movedEnd);
      expect(run({ change, link: linkFor(it_), item: it_, role: "owner" })).toEqual({
        type: "ignore",
        reason: "unchanged",
      });
    }
  });

  it("ignores an event whose item is gone from Caretook (the push removes it)", () => {
    const it_ = item();
    expect(run({ change: eventFor(it_, moved), link: linkFor(it_), item: null, role: "owner" })).toEqual({
      type: "ignore",
      reason: "gone",
    });
  });

  it("ignores an event with our uid but no link here, and a Google-made one already deleted", () => {
    const it_ = item();
    expect(run({ change: eventFor(it_, moved), link: null, item: null, role: "owner" })).toEqual({
      type: "ignore",
      reason: "gone",
    });
    const made = eventFor(it_, { id: "gevt1", status: "cancelled", privateProperties: {} });
    expect(run({ change: made, link: null, item: null, role: "owner" })).toEqual({
      type: "ignore",
      reason: "gone",
    });
  });

  it("ignores deleting an appointment that's already cancelled", () => {
    const it_ = item({ status: "cancelled" });
    const change = eventFor(it_, { status: "cancelled" });
    expect(run({ change, link: linkFor(it_), item: it_, role: "caretaker" })).toEqual({
      type: "ignore",
      reason: "alreadyCancelled",
    });
  });
});

describe("an appointment", () => {
  it.each(WRITERS)("moved in Google updates its start and end, as %s", (role) => {
    const it_ = item();
    const change = eventFor(it_, { ...moved, ...movedEnd });
    expect(run({ change, link: linkFor(it_), item: it_, role })).toEqual({
      type: "updateEntry",
      entryId: "e1",
      patch: { occurredAt: "2026-11-19T19:00:00.000Z", allDay: false, endsAt: "2026-11-19T20:30:00.000Z" },
    });
  });

  it("reads Google's offsets as instants", () => {
    const it_ = item();
    const change = eventFor(it_, {
      start: { dateTime: "2026-11-19T11:00:00-08:00", timeZone: LA },
      end: { dateTime: "2026-11-19T12:00:00-08:00", timeZone: LA },
    });
    expect(run({ change, link: linkFor(it_), item: it_, role: "owner" })).toMatchObject({
      patch: { occurredAt: "2026-11-19T19:00:00.000Z", endsAt: "2026-11-19T20:00:00.000Z" },
    });
  });

  it("made all-day in Google starts at the day's start in its zone, with no end", () => {
    const it_ = item();
    const change = eventFor(it_, { start: { date: "2026-11-20" }, end: { date: "2026-11-21" } });
    expect(run({ change, link: linkFor(it_), item: it_, role: "owner" })).toEqual({
      type: "updateEntry",
      entryId: "e1",
      patch: { occurredAt: "2026-11-20T08:00:00.000Z", allDay: true, endsAt: null },
    });
  });

  it("an all-day one given a time in Google becomes timed", () => {
    const it_ = item({ allDay: true, start: "2026-11-19", end: "2026-11-20" });
    const change = eventFor(it_, { ...moved, ...movedEnd });
    expect(run({ change, link: linkFor(it_), item: it_, role: "owner" })).toEqual({
      type: "updateEntry",
      entryId: "e1",
      patch: { occurredAt: "2026-11-19T19:00:00.000Z", allDay: false, endsAt: "2026-11-19T20:30:00.000Z" },
    });
  });

  it("an all-day one moved to another day", () => {
    const it_ = item({ allDay: true, start: "2026-11-19", end: "2026-11-20" });
    const change = eventFor(it_, { start: { date: "2026-11-23" }, end: { date: "2026-11-24" } });
    expect(run({ change, link: linkFor(it_), item: it_, role: "owner" })).toMatchObject({
      patch: { occurredAt: "2026-11-23T08:00:00.000Z", allDay: true, endsAt: null },
    });
  });

  it.each(WRITERS)("deleted in Google is cancelled, as %s", (role) => {
    const it_ = item();
    const change = eventFor(it_, { status: "cancelled", start: null, end: null });
    expect(run({ change, link: linkFor(it_), item: it_, role })).toEqual({
      type: "cancelEntry",
      entryId: "e1",
      seriesDetached: false,
    });
  });

  it("moved or deleted by a viewer is overwritten", () => {
    const it_ = item();
    for (const change of [eventFor(it_, moved), eventFor(it_, { status: "cancelled" })])
      expect(run({ change, link: linkFor(it_), item: it_, role: "viewer" })).toEqual({
        type: "overwrite",
        reason: "role",
      });
  });

  it("an end at its start isn't an end", () => {
    const it_ = item();
    const change = eventFor(it_, { ...moved, end: moved.start });
    expect(run({ change, link: linkFor(it_), item: it_, role: "owner" })).toMatchObject({
      patch: { occurredAt: "2026-11-19T19:00:00.000Z", endsAt: null },
    });
  });
});

describe("a series visit", () => {
  const visit = (over: Partial<CalendarItem> = {}) =>
    item({ series: { id: "s1", day: "2026-11-19", detached: false }, ...over });

  it.each(WRITERS)("moved in Google is changed on its own (detached), as %s", (role) => {
    const it_ = visit();
    const change = eventFor(it_, { ...moved, ...movedEnd });
    expect(run({ change, link: linkFor(it_), item: it_, role })).toEqual({
      type: "updateEntry",
      entryId: "e1",
      patch: {
        occurredAt: "2026-11-19T19:00:00.000Z",
        allDay: false,
        endsAt: "2026-11-19T20:30:00.000Z",
        seriesDetached: true,
      },
    });
  });

  it("an already detached visit stays detached without saying so again", () => {
    const it_ = visit({ series: { id: "s1", day: "2026-11-19", detached: true } });
    const change = eventFor(it_, { ...moved, ...movedEnd });
    expect(run({ change, link: linkFor(it_), item: it_, role: "owner" })).toEqual({
      type: "updateEntry",
      entryId: "e1",
      patch: { occurredAt: "2026-11-19T19:00:00.000Z", allDay: false, endsAt: "2026-11-19T20:30:00.000Z" },
    });
  });

  it("deleted in Google cancels only this visit", () => {
    const it_ = visit();
    const change = eventFor(it_, { status: "cancelled" });
    expect(run({ change, link: linkFor(it_), item: it_, role: "caretaker" })).toEqual({
      type: "cancelEntry",
      entryId: "e1",
      seriesDetached: true,
    });
  });

  it("a visit that has started keeps its time (overwritten instead)", () => {
    // Wed 18 Nov, 9:00 in Los Angeles: an hour before the clock.
    const it_ = visit({ start: "2026-11-18T17:00:00.000Z", end: "2026-11-18T21:00:00.000Z" });
    expect(
      run({ change: eventFor(it_, { ...moved, ...movedEnd }), link: linkFor(it_), item: it_, role: "owner" }),
    ).toEqual({ type: "overwrite", reason: "pastVisit" });
  });

  it("a viewer's move is overwritten", () => {
    const it_ = visit();
    expect(run({ change: eventFor(it_, moved), link: linkFor(it_), item: it_, role: "viewer" })).toEqual({
      type: "overwrite",
      reason: "role",
    });
  });
});

describe("a todo", () => {
  it.each(WRITERS)("moved in Google changes its due day and time in the recipient's zone, as %s", (role) => {
    const it_ = todo();
    // Fri 20 Nov, 7:30 in Los Angeles.
    const change = eventFor(it_, { start: { dateTime: "2026-11-20T15:30:00.000Z", timeZone: LA } });
    expect(run({ change, link: linkFor(it_), item: it_, role })).toEqual({
      type: "updateTodo",
      todoId: "t1",
      dueOn: "2026-11-20",
      dueTime: "07:30",
    });
  });

  it("made all-day in Google keeps only the day", () => {
    const it_ = todo();
    const change = eventFor(it_, { start: { date: "2026-11-21" }, end: { date: "2026-11-22" } });
    expect(run({ change, link: linkFor(it_), item: it_, role: "owner" })).toEqual({
      type: "updateTodo",
      todoId: "t1",
      dueOn: "2026-11-21",
      dueTime: null,
    });
  });

  it("a viewer's move is overwritten", () => {
    const it_ = todo();
    expect(run({ change: eventFor(it_, moved), link: linkFor(it_), item: it_, role: "viewer" })).toEqual({
      type: "overwrite",
      reason: "role",
    });
  });
});

describe("a delete in Google", () => {
  const deleted = (it_: CalendarItem, role: (typeof ROLES)[number]) =>
    run({ change: eventFor(it_, { status: "cancelled" }), link: linkFor(it_), item: it_, role });
  const IGNORED = { type: "ignore", reason: "started" };
  const PUT_BACK = { type: "overwrite", reason: "todoDelete" };
  // Wed 18 Nov, 9:00 in Los Angeles: an hour before the clock.
  const earlier = { start: "2026-11-18T17:00:00.000Z", end: "2026-11-18T18:00:00.000Z" };
  const today = { allDay: true, start: "2026-11-18", end: "2026-11-19" };

  it.each(ROLES)("leaves a started one-off event as it was, as %s", (role) => {
    expect(deleted(item(earlier), role)).toEqual(IGNORED);
  });

  it.each(ROLES)("leaves a started all-day event on its day, as %s", (role) => {
    expect(deleted(item(today), role)).toEqual(IGNORED);
  });

  it.each(ROLES)("leaves a started visit of a repeat, as %s", (role) => {
    const series = { id: "s1", day: "2026-11-18", detached: false };
    expect(deleted(item({ ...earlier, series }), role)).toEqual(IGNORED);
  });

  it.each(ROLES)("leaves an overdue todo open, timed or all-day, as %s", (role) => {
    expect(deleted(todo(earlier), role)).toEqual(IGNORED);
    expect(deleted(todo({ allDay: true, start: "2026-11-17", end: "2026-11-18" }), role)).toEqual(IGNORED);
    expect(deleted(todo(today), role)).toEqual(IGNORED);
  });

  it("leaves a started event that was already cancelled", () => {
    expect(deleted(item({ ...earlier, status: "cancelled" }), "owner")).toEqual(IGNORED);
  });

  it.each(WRITERS)("still cancels an upcoming one-off event, as %s", (role) => {
    expect(deleted(item(), role)).toEqual({ type: "cancelEntry", entryId: "e1", seriesDetached: false });
  });

  it.each(ROLES)("puts an upcoming todo with a due time back, as %s", (role) => {
    expect(deleted(todo(), role)).toEqual(PUT_BACK);
  });

  it.each(ROLES)("puts an upcoming todo with no due time back, as %s", (role) => {
    expect(deleted(todo({ allDay: true, start: "2026-11-19", end: "2026-11-20" }), role)).toEqual(PUT_BACK);
  });

  it("finds nothing to do for a note (a link whose item is no calendar item)", () => {
    const note = item({ uid: "entry:n1", source: { type: "entry", id: "n1" } });
    expect(
      run({
        change: eventFor(note, { status: "cancelled" }),
        link: linkFor(note),
        item: null,
        role: "owner",
      }),
    ).toEqual({ type: "ignore", reason: "gone" });
  });
});

describe("a new event made in Google", () => {
  const made = (over: Partial<GoogleEvent> = {}): GoogleEvent => ({
    id: "gevt1",
    etag: '"etag-9"',
    status: "confirmed",
    summary: "  Eye exam  ",
    description: "Bring glasses",
    location: "Lakeside Eye Care",
    start: { dateTime: "2026-11-24T22:00:00.000Z", timeZone: LA },
    end: { dateTime: "2026-11-24T23:00:00.000Z", timeZone: LA },
    privateProperties: {},
    updated: "2026-11-18T17:59:00.000Z",
    recurring: false,
    ...over,
  });

  it.each(WRITERS)("becomes an appointment with Google's summary as its title, as %s", (role) => {
    expect(run({ change: made(), link: null, item: null, role })).toEqual({
      type: "createAppointment",
      googleEventId: "gevt1",
      title: "Eye exam",
      occurredAt: "2026-11-24T22:00:00.000Z",
      endsAt: "2026-11-24T23:00:00.000Z",
      allDay: false,
      timeZone: LA,
    });
  });

  it("all-day, in the recipient's zone, and untitled", () => {
    const change = made({ summary: " ", start: { date: "2026-11-25" }, end: { date: "2026-11-26" } });
    expect(run({ change, link: null, item: null, role: "owner" })).toEqual({
      type: "createAppointment",
      googleEventId: "gevt1",
      title: UNTITLED_APPOINTMENT,
      occurredAt: "2026-11-25T08:00:00.000Z",
      endsAt: null,
      allDay: true,
      timeZone: LA,
    });
  });

  const daysOut = (days: number, over: Partial<GoogleEvent> = {}) => {
    const at = new Date(NOW.getTime() + days * 86_400_000).toISOString();
    return made({ start: { dateTime: at, timeZone: LA }, end: { dateTime: at, timeZone: LA }, ...over });
  };
  const OUTSIDE = { type: "ignore", reason: "outsideWindow" };

  it("200 days out is taken, up to the edge of the 365-day horizon", () => {
    for (const days of [200, 364])
      expect(run({ change: daysOut(days), link: null, item: null, role: "owner" })).toMatchObject({
        type: "createAppointment",
      });
    expect(run({ change: daysOut(365), link: null, item: null, role: "owner" })).toEqual(OUTSIDE);
  });

  it("400 days out, or further back than 90, is ignored", () => {
    for (const days of [400, -91])
      expect(run({ change: daysOut(days), link: null, item: null, role: "owner" })).toEqual(OUTSIDE);
  });

  it("an instance of a Google repeat keeps the 90-day horizon", () => {
    const instance = (days: number) => daysOut(days, { recurring: true });
    expect(run({ change: instance(30), link: null, item: null, role: "owner" })).toMatchObject({
      type: "createAppointment",
    });
    for (const days of [90, 200])
      expect(run({ change: instance(days), link: null, item: null, role: "owner" })).toEqual(OUTSIDE);
  });

  it("a viewer's far-off event is overwritten; their far-off repeat instance is left for later", () => {
    expect(run({ change: daysOut(200), link: null, item: null, role: "viewer" })).toEqual({
      type: "overwrite",
      reason: "role",
    });
    expect(
      run({ change: daysOut(200, { recurring: true }), link: null, item: null, role: "viewer" }),
    ).toEqual(OUTSIDE);
  });

  it("a linked item 200 days out takes a time change", () => {
    const start = new Date(NOW.getTime() + 200 * 86_400_000).toISOString();
    const end = new Date(NOW.getTime() + 200 * 86_400_000 + 3_600_000).toISOString();
    const far = item({ start, end });
    const movedTo = new Date(NOW.getTime() + 201 * 86_400_000).toISOString();
    const change = eventFor(far, {
      start: { dateTime: movedTo, timeZone: LA },
      end: { dateTime: movedTo, timeZone: LA },
    });
    expect(run({ change, link: linkFor(far), item: far, role: "owner" })).toMatchObject({
      type: "updateEntry",
      entryId: "e1",
      patch: { occurredAt: movedTo },
    });
  });

  it("outside the horizon, or without a time, is ignored", () => {
    const far = made({ start: { date: "2027-12-20" }, end: { date: "2027-12-21" } });
    expect(run({ change: far, link: null, item: null, role: "owner" })).toEqual({
      type: "ignore",
      reason: "outsideWindow",
    });
    expect(run({ change: made({ start: null }), link: null, item: null, role: "owner" })).toEqual({
      type: "ignore",
      reason: "untimed",
    });
  });

  it("a viewer's is overwritten (the push removes it)", () => {
    expect(run({ change: made(), link: null, item: null, role: "viewer" })).toEqual({
      type: "overwrite",
      reason: "role",
    });
  });

  it("taken in already (linked, not yet tagged), a move updates it", () => {
    const taken = item({ uid: "entry:e9", source: { type: "entry", id: "e9" } });
    const link: PullLink = { itemUid: taken.uid, googleEventId: "gevt1", etag: '"etag-9"' };
    const change = made({ etag: '"etag-10"', start: moved.start, end: movedEnd.end });
    expect(run({ change, link, item: taken, role: "owner" })).toMatchObject({
      type: "updateEntry",
      entryId: "e9",
    });
  });
});
