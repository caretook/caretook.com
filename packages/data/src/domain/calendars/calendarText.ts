import type { CalendarItem, CalendarItemKind } from "./calendarItems";
import type { ShareLevel } from "../../db/schema/calendars/calendarRules";

import { localDate } from "../core/entryTiming";
import { localTime } from "../todos/todoRules";

// What a calendar item says outside Caretook (appointments-2): the email's
// subject and body, the feed's and Google's event. Generic by default:
// "Event for Pat", the time and a link back, and nothing else. With
// `details` (shareLevel), the title, place and providers' names are added.
// It never says more: a CalendarItem carries no note text to say.

const NOUNS: Record<CalendarItemKind, string> = {
  appointment: "Event",
  todo: "Todo",
};

const dayFormats = new Map<string, Intl.DateTimeFormat>();
const dayFormat = (timeZone: string) => {
  let format = dayFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" });
    dayFormats.set(timeZone, format);
  }
  return format;
};

/** "2026-11-19" → "Thu, Nov 19". */
const dayText = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return dayFormat("UTC").format(new Date(Date.UTC(y!, m! - 1, d)));
};

const zoneFormats = new Map<string, Intl.DateTimeFormat>();
/** The zone's short name at an instant: "PST", "PDT", or `Intl`'s "GMT+1" where there's no US one. */
const zoneName = (instant: string, timeZone: string) => {
  let format = zoneFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" });
    zoneFormats.set(timeZone, format);
  }
  return format.formatToParts(new Date(instant)).find((part) => part.type === "timeZoneName")!.value;
};

/** An instant in a zone, in pieces: its day, "9:00", "AM" and "PST". */
const moment = (instant: string, timeZone: string) => {
  const [h, m] = localTime(instant, timeZone).split(":");
  const hour = Number(h);
  return {
    day: localDate(instant, timeZone),
    time: `${hour % 12 || 12}:${m}`,
    period: hour < 12 ? "AM" : "PM",
    zone: zoneName(instant, timeZone),
  };
};

/**
 * When it is, in `timeZone`: "Thu, Nov 19 · 9:00–10:00 AM PST", "Thu, Nov 19
 * · 11:30 AM–1:00 PM PST", "Thu, Nov 19 · All day" (no zone), "Thu, Nov 19 ·
 * 9:00 AM PST" (a todo: its end is made up, so it isn't shown), or "Thu, Nov
 * 19 10:00 PM – Fri, Nov 20 1:00 AM PST" across midnight. A range across a
 * clock change names the zone at each end, since one name would misstate one.
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
  const start = moment(item.start, timeZone);
  const startAt = `${start.time} ${start.period}`;
  if (item.kind !== "appointment") return `${dayText(start.day)} · ${startAt} ${start.zone}`;
  const end = moment(item.end, timeZone);
  const endAt = `${end.time} ${end.period}`;
  const sameDay = end.day === start.day;
  if (end.zone !== start.zone) {
    return sameDay
      ? `${dayText(start.day)} · ${startAt} ${start.zone}–${endAt} ${end.zone}`
      : `${dayText(start.day)} ${startAt} ${start.zone} – ${dayText(end.day)} ${endAt} ${end.zone}`;
  }
  if (!sameDay) return `${dayText(start.day)} ${startAt} – ${dayText(end.day)} ${endAt} ${end.zone}`;
  const range = start.period === end.period ? `${start.time}–${endAt}` : `${startAt}–${endAt}`;
  return `${dayText(start.day)} · ${range} ${end.zone}`;
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
