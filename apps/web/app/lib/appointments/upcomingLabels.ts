import type { TimedEntry } from "./upcoming";

import { isUnnamedEvent } from "../live-notes/liveEntry";
import { entryTiming } from "./upcoming";
import { dayLabel } from "@caretook/data/domain";

// The words for appointments: time ranges, "Now · until …",
// "Cancelled", "Rescheduled to …" and the Next strip. Pure, with `locale`
// and `timeZone` passed in by tests (screens leave them to the device).
// Unit-tested in web:unit.

type Where = { locale?: string; timeZone?: string };

const timeOf = (iso: string, { locale, timeZone }: Where) =>
  new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));

/** An entry's time: "10:30 AM", "10:30 AM–11:15 AM" with an end, or "All day". */
export const timeRange = (entry: TimedEntry, where: Where = {}) => {
  if (entry.allDay) return "All day";
  const start = timeOf(entry.occurredAt, where);
  return entry.endsAt ? `${start}–${timeOf(entry.endsAt, where)}` : start;
};

/** An item in progress: "Now · until 11:15 AM" (or just "Now" without an end). */
export const nowLabel = (entry: TimedEntry, where: Where = {}) =>
  entry.endsAt ? `Now · until ${timeOf(entry.endsAt, where)}` : "Now";

/** "Cancelled" for a cancelled event, else null. */
export const cancelledLabel = (entry: Pick<TimedEntry, "cancelledAt">) =>
  entry.cancelledAt ? "Cancelled" : null;

/** Where a cancelled event moved to: "Rescheduled to Tue, Dec 1". */
export const rescheduledLabel = (to: Pick<TimedEntry, "occurredAt">, where: Where = {}) =>
  `Rescheduled to ${new Intl.DateTimeFormat(where.locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: where.timeZone,
  }).format(new Date(to.occurredAt))}`;

/** What an upcoming item is called: its title, else "Event". */
export const upcomingTitle = (entry: { kind: string; title?: string | null }) =>
  entry.title?.trim() || "Event";

/** The Today card's next line: an unnamed event still ahead is "Upcoming event". */
export const nextEventTitle = (entry: TimedEntry & { kind: string; title?: string | null }, now: Date) =>
  isUnnamedEvent(entry.kind, entry.title) && entryTiming(entry, now) === "upcoming"
    ? "Upcoming event"
    : upcomingTitle(entry);

/**
 * When an upcoming item is, in a line: "Tomorrow 10:30 AM", "Friday, Nov 20"
 * for an all-day item, or "Now · until 11:15 AM" while it's in progress.
 */
export const upcomingWhen = (entry: TimedEntry, now: Date, where: Where = {}) => {
  const zone = where.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const start = new Date(entry.occurredAt).getTime();
  if (!entry.allDay && start <= now.getTime()) return nowLabel(entry, where);
  // An all-day item's day is its own zone's.
  const day = dayLabel(entry.occurredAt, entry.allDay ? entry.timeZone : zone, now, where.locale);
  return entry.allDay ? day : `${day} ${timeOf(entry.occurredAt, where)}`;
};

/**
 * The Next strip: "Next: Dr. Alvarez · Tomorrow 10:30 AM · +3 more". Null
 * when nothing is upcoming (the strip hides).
 */
export const nextStripText = (
  { next, more }: { next: (TimedEntry & { kind: string; title?: string | null }) | null; more: number },
  now: Date,
  where: Where = {},
  titleOf: (entry: TimedEntry & { kind: string; title?: string | null }) => string = upcomingTitle,
) => {
  if (!next) return null;
  const parts = [`Next: ${titleOf(next)}`, upcomingWhen(next, now, where)];
  if (more > 0) parts.push(`+${more} more`);
  return parts.join(" · ");
};
