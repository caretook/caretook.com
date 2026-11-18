import { getLocalTimeZone } from "@internationalized/date";

// Times show in the viewer's time zone, with the entry's own zone noted when
// it differs ("8:00 AM, 11:00 AM in New York").

export const localTimeZone = () => getLocalTimeZone();

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });
const timeFormat = (timeZone?: string) =>
  new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone });

/** A stable key for the viewer's calendar day. */
export const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA");

export const formatDay = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return dayFormat.format(date);
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
