import type { CalendarItem, CalendarItemKind } from "./calendarItems";
import type { ShareLevel } from "./calendarRules";

import { localDate } from "../core/entryTiming";
import { localTime } from "../tasks/taskRules";

// What a calendar item says outside Caretook (appointments-2): the email's
// subject and body, the feed's and Google's event. Generic by default:
// "Appointment for Pat", the time and a link back, and nothing else. With
// `details` (shareLevel), the title, place and providers' names are added.
// It never says more: a CalendarItem carries no note text to say.

const NOUNS: Record<CalendarItemKind, string> = {
  appointment: "Appointment",
  reminder: "Reminder",
  task: "Task",
};

const dayFormats = new Map<string, Intl.DateTimeFormat>();
const dayFormat = (timeZone: string) => {
  let format = dayFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short" });
    dayFormats.set(timeZone, format);
  }
  return format;
};

/** "2026-11-19" → "Thu 19 Nov". */
const dayText = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return dayFormat("UTC").format(new Date(Date.UTC(y!, m! - 1, d)));
};

/** An instant's wall-clock time in a zone: "9:00", "18:30". */
const clock = (instant: string, timeZone: string) => {
  const [h, m] = localTime(instant, timeZone).split(":");
  return `${Number(h)}:${m}`;
};

/**
 * When it is, in `timeZone`: "Thu 19 Nov · 9:00–10:00", "Thu 19 Nov · All
 * day", "Thu 19 Nov · 9:00" (a reminder or task: its end is made up, so it
 * isn't shown), or "Thu 19 Nov 22:00 – Fri 20 Nov 1:00" across midnight.
 */
export const calendarWhen = (
  item: Pick<CalendarItem, "kind" | "allDay" | "start" | "end">,
  timeZone: string,
) => {
  if (item.allDay) {
    const last = localDate(Date.parse(`${item.end}T00:00:00Z`) - 1, "UTC");
    return last === item.start
      ? `${dayText(item.start)} · All day`
      : `${dayText(item.start)} – ${dayText(last)} · All day`;
  }
  const startDay = localDate(item.start, timeZone);
  const start = clock(item.start, timeZone);
  if (item.kind !== "appointment") return `${dayText(startDay)} · ${start}`;
  const endDay = localDate(item.end, timeZone);
  const end = clock(item.end, timeZone);
  return endDay === startDay
    ? `${dayText(startDay)} · ${start}–${end}`
    : `${dayText(startDay)} ${start} – ${dayText(endDay)} ${end}`;
};

export type CalendarText = {
  /** The one line: an email's subject, an event's summary. */
  summary: string;
  /** When, in the zone asked for. */
  when: string;
  /** The place (details only). */
  location: string | null;
  /** The body: when, providers (details only), and the link back. */
  description: string;
};

/**
 * The wording of `item` at `level`, its times in `timeZone` (the item's own
 * by default; reminders pass the member's). Generic text never holds the
 * title, place or providers.
 */
export const calendarText = (
  item: CalendarItem,
  level: ShareLevel,
  timeZone = item.timeZone,
): CalendarText => {
  const details = level === "details";
  const generic = `${NOUNS[item.kind]} for ${item.recipientName}`;
  const named = details && item.title ? `${generic}: ${item.title}` : generic;
  const summary = item.status === "cancelled" ? `Cancelled: ${named}` : named;
  const when = calendarWhen(item, timeZone);
  const providers = details && item.providers.length ? `With ${item.providers.join(", ")}` : null;
  const lines = [when, providers, `Open in Caretook: ${item.appUrl}`].filter((line) => line !== null);
  return {
    summary,
    when,
    location: details ? item.place : null,
    description: lines.join("\n"),
  };
};
