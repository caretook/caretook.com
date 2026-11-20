import { getLocalTimeZone } from "@internationalized/date";

// Times show in the viewer's time zone, with the entry's own zone noted when
// it differs ("8:00 AM, 11:00 AM in New York").

export const localTimeZone = () => getLocalTimeZone();

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });
const timeFormat = (timeZone?: string) =>
  new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone });

export const formatDay = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return dayFormat.format(date);
};

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

export const formatTime = (iso: string) => timeFormat().format(new Date(iso));

/** The time where the entry was written, when that's a different zone; else null. */
export const formatTimeInZone = (iso: string, timeZone: string) => {
  if (timeZone === localTimeZone()) return null;
  const place = timeZone.split("/").at(-1)?.replaceAll("_", " ") ?? timeZone;
  return `${timeFormat(timeZone).format(new Date(iso))} in ${place}`;
};

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "narrow" });

/** "just now", "25m ago", "3h ago", "yesterday", "4d ago", then a date. */
export const formatAgo = (iso: string, now = Date.now()) => {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return relative.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return relative.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 7) return relative.format(-days, "day");
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
