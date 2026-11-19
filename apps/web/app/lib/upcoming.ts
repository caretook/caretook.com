import { endOfDay, localDate } from "@caretook/data/schema";

// The time rules for appointments and reminders (future events and notes).
// Every screen that splits the past from what's coming (the history, the
// Next strip, the Upcoming block and section, the entry page) decides it
// here, so they always agree. Pure: callers pass `now` (from a clock such as
// `useNow`). Unit-tested in web:unit.
//
// "Upcoming" is worked out, never stored:
// - An item is upcoming while its start is after now.
// - With an end time, it's "now" from its start until its end (in Upcoming as
//   "Now · until …", and in the history from its start), then past.
// - An all-day item is upcoming through the end of its day in the entry's
//   own time zone (DST-safe: days can be 23 or 25 hours).

/** The fields the rules read (a `TimelineEntry` has them all). */
export type TimedEntry = {
  id: string;
  occurredAt: string;
  timeZone: string;
  endsAt?: string | null;
  allDay?: boolean;
  cancelledAt?: string | null;
};

export type EntryTiming = "past" | "upcoming" | "now";

const ms = (iso: string) => new Date(iso).getTime();

/** Where an entry stands at `now`: past, upcoming, or in progress ("now"). */
export const entryTiming = (entry: TimedEntry, now: Date): EntryTiming => {
  const at = now.getTime();
  const start = ms(entry.occurredAt);
  if (entry.allDay) return at < endOfDay(start, entry.timeZone) ? "upcoming" : "past";
  if (start > at) return "upcoming";
  if (entry.endsAt && ms(entry.endsAt) > at) return "now";
  return "past";
};

/** True while an entry belongs in Upcoming: upcoming or in progress. */
export const isUpcoming = (entry: TimedEntry, now: Date) => entryTiming(entry, now) !== "past";

/**
 * Upcoming's order, as a sort comparator: soonest day first, all-day items
 * first within their day, then by start, then by id (a stable tie-break).
 * An entry's day is its calendar day in its own zone.
 */
export const upcomingOrder = (a: TimedEntry, b: TimedEntry) => {
  const dayA = localDate(a.occurredAt, a.timeZone);
  const dayB = localDate(b.occurredAt, b.timeZone);
  if (dayA !== dayB) return dayA < dayB ? -1 : 1;
  if (!!a.allDay !== !!b.allDay) return a.allDay ? -1 : 1;
  const byStart = ms(a.occurredAt) - ms(b.occurredAt);
  if (byStart !== 0) return byStart;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

/** The items still upcoming (or in progress) at `now`, in Upcoming's order. */
export const upcomingItems = <T extends TimedEntry>(items: readonly T[], now: Date) =>
  items.filter((item) => isUpcoming(item, now)).sort(upcomingOrder);

/**
 * What the Next strip shows: the first item still upcoming or in progress,
 * skipping cancelled ones (a cancelled appointment is never "next"), and how
 * many more there are after it.
 */
export const nextUp = <T extends TimedEntry>(items: readonly T[], now: Date) => {
  const live = upcomingItems(
    items.filter((item) => !item.cancelledAt),
    now,
  );
  return { next: live[0] ?? null, more: Math.max(0, live.length - 1) };
};

const MINUTE_MS = 60_000;

/**
 * Where the timeline's history ends (`historyWindow`), as ISO 8601: the end
 * of the current minute. It comes from a once-a-minute clock, so the query
 * stays the same within a minute; rounding up means a note or event saved
 * "now" shows in the history at once, never a minute later.
 */
export const historyCutoff = (now: Date) =>
  new Date(Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS + MINUTE_MS).toISOString();
