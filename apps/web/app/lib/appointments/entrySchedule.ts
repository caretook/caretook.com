import type { TimedEntry } from "./upcoming";

import { CalendarDateTime, toZoned } from "@internationalized/date";
import { dayStart, localDate } from "@caretook/data/schema";
import { dayLabel, localTimeZone } from "../core/format";
import { timeRange } from "./upcomingLabels";

// When a note or event is: its start, an optional end (events) and all day.
// The entry page's time chip edits one of these and saves it when it
// closes; the same rules suit any screen that sets a time (the reschedule
// sheet). Pure, unit-tested in web:unit. The content schema has the final
// say (lib/timeline/timeline.sync.ts validates every write).

export type Schedule = {
  /** ISO 8601. All day: the first instant of its day in the entry's zone. */
  occurredAt: string;
  /** ISO 8601, after the start; events only, and never all day. */
  endsAt: string | null;
  allDay: boolean;
};

/** The field error for an end at or before the start (the content schema's wording). */
export const END_BEFORE_START = "Must be after the start";

/** The hour a timed item starts at when only its day is known (a day picked first, all day turned off). */
export const DEFAULT_START = { hour: 9, minute: 0 } as const;

const HOUR_MS = 3_600_000;
const ms = (iso: string) => new Date(iso).getTime();

/** The first instant of the day `iso` falls on in `timeZone`, as ISO 8601. */
const startOfDay = (iso: string, timeZone: string) =>
  new Date(dayStart(localDate(iso, timeZone), timeZone)).toISOString();

/** `hour:minute` on the day `iso` falls on in `timeZone` (DST-safe), as ISO 8601. */
export const atTimeOfDay = (
  iso: string,
  timeZone: string,
  { hour, minute }: { hour: number; minute: number },
) => {
  const [y, m, d] = localDate(iso, timeZone).split("-").map(Number);
  return toZoned(new CalendarDateTime(y!, m!, d!, hour, minute), timeZone).toAbsoluteString();
};

/**
 * Turn all day on or off. On: the start moves to the start of its day in
 * the entry's zone and the end goes. Off: it starts at 9:00 that day.
 */
export const withAllDay = (schedule: Schedule, allDay: boolean, timeZone: string): Schedule => {
  if (allDay === schedule.allDay) return schedule;
  return allDay
    ? { occurredAt: startOfDay(schedule.occurredAt, timeZone), endsAt: null, allDay: true }
    : { occurredAt: atTimeOfDay(schedule.occurredAt, timeZone, DEFAULT_START), endsAt: null, allDay: false };
};

/** A new start (from the field). An all-day item keeps to the start of the day picked. */
export const withStart = (schedule: Schedule, occurredAt: string, timeZone: string): Schedule => ({
  ...schedule,
  occurredAt: schedule.allDay ? startOfDay(occurredAt, timeZone) : occurredAt,
});

/** A new end, or none. All-day items have none. */
export const withEnd = (schedule: Schedule, endsAt: string | null): Schedule =>
  schedule.allDay ? schedule : { ...schedule, endsAt };

/** Where "Add an end time" starts: an hour after the start. */
export const defaultEnd = (schedule: Schedule) => new Date(ms(schedule.occurredAt) + HOUR_MS).toISOString();

/** The end's field error, or null while it's fine (or there's none). */
export const endError = (schedule: Schedule) =>
  schedule.endsAt && ms(schedule.endsAt) <= ms(schedule.occurredAt) ? END_BEFORE_START : null;

const sameInstant = (a: string | null, b: string | null) => (a && b ? ms(a) === ms(b) : a === b);

export const sameSchedule = (a: Schedule, b: Schedule) =>
  a.allDay === b.allDay && sameInstant(a.occurredAt, b.occurredAt) && sameInstant(a.endsAt, b.endsAt);

/**
 * What to save when the chip closes: the edited schedule, or null when
 * nothing changed, or when its end is before its start (closing then keeps
 * what was saved; Done stays open to show the error).
 */
export const scheduleToSave = (edited: Schedule, saved: Schedule) =>
  endError(edited) || sameSchedule(edited, saved) ? null : edited;

type Where = { locale?: string; timeZone?: string };

/**
 * The entry's time in a line: "Tomorrow, 10:30 AM–11:15 AM", "Monday, Nov
 * 16, 2:15 PM", or "Friday, Nov 20 · All day" (an all-day item's day is its
 * own zone's).
 */
export const scheduleText = (entry: TimedEntry, now: Date, where: Where = {}) => {
  if (entry.allDay) return `${dayLabel(entry.occurredAt, entry.timeZone, now, where.locale)} · All day`;
  const day = dayLabel(entry.occurredAt, where.timeZone ?? localTimeZone(), now, where.locale);
  return `${day}, ${timeRange(entry, where)}`;
};
