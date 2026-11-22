// A day heading in a zone ("Today", "Yesterday", "Monday, Nov 16"). Pure, shared with the
// connector's wording.

const DAY_MS = 86_400_000;

/** The calendar day an instant falls on in a zone, as a UTC-midnight timestamp (so days subtract evenly). */
const calendarDay = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: part("year"), day: Date.UTC(part("year"), part("month") - 1, part("day")) };
};

/**
 * A timeline day heading in the viewer's zone: "Today", "Yesterday", "Tomorrow", then
 * "Monday, Nov 16", with the year ("Monday, Nov 16, 2025") when it isn't
 * `now`'s. Days are compared as calendar days in `timeZone`, never as 24-hour
 * spans, so it holds around midnight and across a DST change.
 */
export const dayLabel = (iso: string, timeZone: string, now: Date, locale?: string) => {
  const date = new Date(iso);
  const then = calendarDay(date, timeZone);
  const today = calendarDay(now, timeZone);
  const daysAgo = Math.round((today.day - then.day) / DAY_MS);
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo === -1) return "Tomorrow";
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "long",
    month: "short",
    day: "numeric",
    year: then.year === today.year ? undefined : "numeric",
  }).format(date);
};
