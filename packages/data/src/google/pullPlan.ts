import type { GroupRoleName } from "../constants/roles";
import type { CalendarItem } from "../db/schema";
import type { GoogleEvent, GoogleEventTime } from "./client";

import { calendarWindow, dayStart, isTodoWriter, localDate, localTime } from "../db/schema";
import { UID_PROPERTY } from "./client";

// What a change pulled from a member's Google calendar means for Caretook
// (appointments-2, slice 9), pure: one action per changed event, which the
// pull (calendarPullService) applies through the services as that member.
//
// - **Our echo** (the etag we stored at the push), or an event whose times
//   already match the item: ignore. Only times come back; a title, place or
//   description edited in Google is left as it is (out of scope).
// - **An appointment:** a time change updates its start, end and all-day; a
//   delete cancels it. On a series visit the change is "Only this visit" (it
//   detaches); a visit that has already started is never rewritten.
// - **A reminder:** a time change moves it; a delete removes it.
// - **A todo:** a time change moves its due day and time; a delete marks it done.
// - **A new event without our uid** (made in Google, in the window): a new
//   appointment with Google's summary as its title. The next push tags it,
//   at the member's share level (generic by default).
// - **What the member's role can't do** (a viewer's edit): `overwrite`, and
//   the next push puts our version back (a viewer's new event is removed).
//   A viewer's deleted todo is still offered as `completeTodo`: the service
//   lets them tick a todo assigned to them, and anything it refuses becomes
//   an overwrite too.

/** What a pull knows of a pushed event (a `google_event_link`). */
export type PullLink = { itemUid: string; googleEventId: string; etag: string | null };

export type EntryTimePatch = {
  occurredAt: string;
  allDay: boolean;
  /** Appointments only: the end, or null when all-day. */
  endsAt?: string | null;
  /** A series visit changed on its own ("Only this visit"). */
  seriesDetached?: true;
};

export type GoogleChangeAction =
  | {
      type: "ignore";
      reason: "echo" | "unchanged" | "gone" | "alreadyCancelled" | "untimed" | "outsideWindow";
    }
  | { type: "updateEntry"; entryId: string; patch: EntryTimePatch }
  | { type: "cancelEntry"; entryId: string; seriesDetached: boolean }
  | { type: "removeEntry"; entryId: string }
  | { type: "updateTodo"; todoId: string; dueOn: string; dueTime: string | null }
  | { type: "completeTodo"; todoId: string }
  | {
      type: "createAppointment";
      googleEventId: string;
      title: string;
      occurredAt: string;
      endsAt: string | null;
      allDay: boolean;
      timeZone: string;
    }
  | { type: "overwrite"; reason: "role" | "pastVisit" };

/** The title a Google-made event takes when it has none. */
export const UNTITLED_APPOINTMENT = "Appointment";
const TITLE_LIMIT = 200;

/** A time from Google as an instant (ms), or an all-day event's day. */
const startOf = (time: GoogleEventTime) =>
  "date" in time ? { day: time.date } : { at: new Date(time.dateTime).getTime() };

const validTime = (time: GoogleEventTime | null): time is GoogleEventTime => {
  if (!time) return false;
  if ("date" in time) return /^\d{4}-\d{2}-\d{2}$/.test(time.date);
  return Number.isFinite(new Date(time.dateTime).getTime());
};

const iso = (ms: number) => new Date(ms).toISOString();
const ms = (value: string) => new Date(value).getTime();

/** Whether the event's times are the item's (reminders and todos have no real end, so only the start counts). */
const sameTimes = (item: CalendarItem, start: GoogleEventTime, end: GoogleEventTime | null) => {
  const s = startOf(start);
  if (item.allDay !== "day" in s) return false;
  if ("day" in s) return s.day === item.start;
  if (s.at !== ms(item.start)) return false;
  if (item.kind !== "appointment" || !end || "date" in end) return true;
  return ms(end.dateTime) === ms(item.end);
};

/** An entry's new times from Google's, read in the entry's own zone. */
const entryPatch = (
  item: CalendarItem,
  start: GoogleEventTime,
  end: GoogleEventTime | null,
): EntryTimePatch => {
  const appointment = item.kind === "appointment";
  const detach = item.series && !item.series.detached ? { seriesDetached: true as const } : {};
  if ("date" in start)
    return {
      occurredAt: iso(dayStart(start.date, item.timeZone)),
      allDay: true,
      ...(appointment && { endsAt: null }),
      ...detach,
    };
  const at = ms(start.dateTime);
  const until = end && "dateTime" in end ? ms(end.dateTime) : null;
  return {
    occurredAt: iso(at),
    allDay: false,
    // An end at or before the start isn't one (Google allows a zero-length event).
    ...(appointment && { endsAt: until !== null && until > at ? iso(until) : null }),
    ...detach,
  };
};

/** Whether an item has begun by `now` (an all-day one from the start of its day). */
const started = (item: CalendarItem, now: Date) =>
  (item.allDay ? dayStart(item.start, item.timeZone) : ms(item.start)) <= now.getTime();

/** A Google-made event as a new appointment, in the recipient's zone. */
const newAppointment = (
  change: GoogleEvent,
  start: GoogleEventTime,
  end: GoogleEventTime | null,
  timeZone: string,
): GoogleChangeAction => {
  const title = change.summary?.trim().slice(0, TITLE_LIMIT) || UNTITLED_APPOINTMENT;
  if ("date" in start)
    return {
      type: "createAppointment",
      googleEventId: change.id,
      title,
      occurredAt: iso(dayStart(start.date, timeZone)),
      endsAt: null,
      allDay: true,
      timeZone,
    };
  const at = ms(start.dateTime);
  const until = end && "dateTime" in end ? ms(end.dateTime) : null;
  return {
    type: "createAppointment",
    googleEventId: change.id,
    title,
    occurredAt: iso(at),
    endsAt: until !== null && until > at ? iso(until) : null,
    allDay: false,
    timeZone,
  };
};

/** Whether a Google-made event falls in the calendar window (90 days each way). */
const inWindow = (start: GoogleEventTime, timeZone: string, now: Date) => {
  const { from, to } = calendarWindow(now);
  const at = "date" in start ? dayStart(start.date, timeZone) : ms(start.dateTime);
  return at >= from.getTime() && at < to.getTime();
};

/**
 * What one changed Google event means. `link` is what we pushed for it (by
 * Google's event id), `item` the Caretook item that link (or the event's
 * uid) names, as it is now in the window (null when deleted, done or out of
 * it), `role` the connecting member's in the group, `timeZone` the care
 * recipient's (a new event's zone).
 */
export const interpretGoogleChange = ({
  change,
  link,
  item,
  role,
  now,
  timeZone,
}: {
  change: GoogleEvent;
  link: PullLink | null;
  item: CalendarItem | null;
  role: GroupRoleName;
  now: Date;
  timeZone: string;
}): GoogleChangeAction => {
  const writer = isTodoWriter(role);
  const deleted = change.status === "cancelled";

  if (!link) {
    // Ours, but not this connection's (or a link since removed): nothing to do.
    if (change.privateProperties[UID_PROPERTY]) return { type: "ignore", reason: "gone" };
    // Made in Google, then deleted before we saw it.
    if (deleted) return { type: "ignore", reason: "gone" };
    if (!validTime(change.start)) return { type: "ignore", reason: "untimed" };
    if (!inWindow(change.start, timeZone, now)) return { type: "ignore", reason: "outsideWindow" };
    if (!writer) return { type: "overwrite", reason: "role" };
    return newAppointment(change, change.start, change.end, timeZone);
  }

  if (link.etag && change.etag === link.etag) return { type: "ignore", reason: "echo" };
  // The item is gone from Caretook (deleted, done, out of the window): the push removes the event.
  if (!item) return { type: "ignore", reason: "gone" };

  const { id } = item.source;
  if (deleted) {
    if (item.kind === "todo") return { type: "completeTodo", todoId: id };
    if (!writer) return { type: "overwrite", reason: "role" };
    if (item.series && started(item, now)) return { type: "overwrite", reason: "pastVisit" };
    if (item.kind === "reminder") return { type: "removeEntry", entryId: id };
    if (item.status === "cancelled") return { type: "ignore", reason: "alreadyCancelled" };
    return { type: "cancelEntry", entryId: id, seriesDetached: !!item.series && !item.series.detached };
  }

  if (!validTime(change.start)) return { type: "ignore", reason: "untimed" };
  const end = validTime(change.end) ? change.end : null;
  if (sameTimes(item, change.start, end)) return { type: "ignore", reason: "unchanged" };
  if (!writer) return { type: "overwrite", reason: "role" };
  if (item.series && started(item, now)) return { type: "overwrite", reason: "pastVisit" };

  if (item.kind === "todo") {
    const start = change.start;
    if ("date" in start) return { type: "updateTodo", todoId: id, dueOn: start.date, dueTime: null };
    return {
      type: "updateTodo",
      todoId: id,
      dueOn: localDate(start.dateTime, item.timeZone),
      dueTime: localTime(start.dateTime, item.timeZone).slice(0, 5),
    };
  }
  return { type: "updateEntry", entryId: id, patch: entryPatch(item, change.start, end) };
};
