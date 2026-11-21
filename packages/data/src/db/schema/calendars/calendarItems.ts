import type { TimelineEntry } from "../timeline/timelineEntry";
import type { Task } from "../tasks/task";

import { addDays, dayStart, localDate } from "../core/entryTiming";
import { zonedInstant } from "../core/zonedDay";

// One projection of a care group's calendar (appointments-2), shared by the
// iCal feed, reminder emails and Google Calendar: appointments (events),
// reminders (notes planned ahead) and open tasks with a due day, as neutral
// `CalendarItem`s. Pure and client-safe. Wording is `calendarText`'s, and how
// much of an item may leave is `shareLevel`'s; nothing here reads a note's
// body or live notes, so no note content can leave through it.

/** How far back and ahead the feed, reminders and Google look. */
export const CALENDAR_WINDOW_DAYS = 90;

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/** The window around `now`: 90 days back to 90 days ahead, as `[from, to)`. */
export const calendarWindow = (now: Date) => ({
  from: new Date(now.getTime() - CALENDAR_WINDOW_DAYS * DAY_MS),
  to: new Date(now.getTime() + CALENDAR_WINDOW_DAYS * DAY_MS),
});

/**
 * How long an item lasts when nothing says: an appointment without an end
 * an hour, a reminder or a timed task half an hour (calendars need an end).
 */
export const DEFAULT_ITEM_MINUTES = { appointment: 60, reminder: 30, task: 30 } as const;

export const CALENDAR_ITEM_KINDS = ["appointment", "reminder", "task"] as const;
export type CalendarItemKind = (typeof CALENDAR_ITEM_KINDS)[number];

export type CalendarItemStatus = "confirmed" | "cancelled";

export type CalendarItem = {
  /** Stable per entry or task: `entry:<id>` or `task:<id>`. */
  uid: string;
  source: { type: "entry" | "task"; id: string };
  groupId: string;
  kind: CalendarItemKind;
  /**
   * All-day: `start` and `end` are days ("YYYY-MM-DD", the end exclusive).
   * Otherwise ISO 8601 instants (UTC).
   */
  allDay: boolean;
  start: string;
  end: string;
  /** The zone its day and times are read in: the entry's own, or the recipient's for a task. */
  timeZone: string;
  status: CalendarItemStatus;
  /** The care recipient's name ("Pat"), for the generic wording. */
  recipientName: string;
  title: string | null;
  place: string | null;
  /** Linked providers' names. */
  providers: readonly string[];
  /** A series visit (appointments-2): its series, the day the rule gave, and whether it was changed alone. */
  series: { id: string; day: string; detached: boolean } | null;
  /** The item's page in Caretook. */
  appUrl: string;
};

/** What the projection reads of an entry (a `TimelineEntry` row has it all), plus its providers' names. */
export type CalendarEntryInput = Pick<
  TimelineEntry,
  | "id"
  | "groupId"
  | "kind"
  | "occurredAt"
  | "timeZone"
  | "endsAt"
  | "allDay"
  | "title"
  | "place"
  | "cancelledAt"
  | "deletedAt"
  | "createdAt"
  | "seriesId"
  | "seriesDay"
  | "seriesDetached"
> & { providers?: readonly string[] };

export type CalendarTaskInput = Pick<
  Task,
  "id" | "groupId" | "title" | "dueOn" | "dueTime" | "doneAt" | "deletedAt"
>;

export type CalendarItemsArgs = {
  entries: readonly CalendarEntryInput[];
  tasks: readonly CalendarTaskInput[];
  /** The care recipient: their name for the wording, and their zone for tasks' due days and times. */
  recipient: { displayName: string; timeZone: string };
  from: Date;
  to: Date;
  /** The app's origin (`APP_URL`), for each item's link. */
  appUrl: string;
};

const iso = (value: string | number | Date) => new Date(value).toISOString();
const ms = (value: string | number | Date) => new Date(value).getTime();

/**
 * Whether a note is a reminder: a series visit, or written before it was
 * due (before it starts, or for an all-day note before its day ends). A note
 * logged as it happens, or later, is a timeline note and stays out.
 */
const isReminder = (entry: CalendarEntryInput) => {
  if (entry.seriesId) return true;
  const due = entry.allDay
    ? dayStart(addDays(localDate(entry.occurredAt, entry.timeZone), 1), entry.timeZone)
    : ms(entry.occurredAt);
  return ms(entry.createdAt) < due;
};

const entryKind = (entry: CalendarEntryInput): CalendarItemKind | null => {
  if (entry.kind === "event") return "appointment";
  if (entry.kind === "note" && isReminder(entry)) return "reminder";
  return null;
};

type Span = Pick<CalendarItem, "allDay" | "start" | "end" | "timeZone">;

const daySpan = (day: string, timeZone: string): Span => ({
  allDay: true,
  start: day,
  end: addDays(day, 1),
  timeZone,
});

const timedSpan = (start: string | number | Date, end: number, timeZone: string): Span => ({
  allDay: false,
  start: iso(start),
  end: iso(end),
  timeZone,
});

const entrySpan = (entry: CalendarEntryInput, kind: CalendarItemKind): Span => {
  if (entry.allDay) return daySpan(localDate(entry.occurredAt, entry.timeZone), entry.timeZone);
  const start = ms(entry.occurredAt);
  const end =
    kind === "appointment" && entry.endsAt
      ? ms(entry.endsAt)
      : start + DEFAULT_ITEM_MINUTES[kind] * MINUTE_MS;
  return timedSpan(start, end, entry.timeZone);
};

const taskSpan = (task: CalendarTaskInput & { dueOn: string }, timeZone: string): Span => {
  if (!task.dueTime) return daySpan(task.dueOn, timeZone);
  const start = zonedInstant(task.dueOn, task.dueTime, timeZone).getTime();
  return timedSpan(start, start + DEFAULT_ITEM_MINUTES.task * MINUTE_MS, timeZone);
};

/** The instants a span covers, `[from, to)`. */
const spanBounds = (span: Span) =>
  span.allDay
    ? { from: dayStart(span.start, span.timeZone), to: dayStart(span.end, span.timeZone) }
    : { from: ms(span.start), to: ms(span.end) };

const trimSlash = (url: string) => url.replace(/\/+$/, "");

/**
 * A group's calendar between `from` and `to`: appointments (cancelled ones
 * kept, marked cancelled), reminders, and open tasks with a due day, each
 * overlapping the window. Deleted entries and tasks, done tasks and undated
 * tasks are left out. Soonest first.
 */
export const calendarItems = ({
  entries,
  tasks,
  recipient,
  from,
  to,
  appUrl,
}: CalendarItemsArgs): CalendarItem[] => {
  const base = trimSlash(appUrl);
  const inWindow = (span: Span) => {
    const bounds = spanBounds(span);
    return bounds.to > from.getTime() && bounds.from < to.getTime();
  };
  const items: { at: number; item: CalendarItem }[] = [];

  for (const entry of entries) {
    if (entry.deletedAt) continue;
    const kind = entryKind(entry);
    if (!kind) continue;
    const span = entrySpan(entry, kind);
    if (!inWindow(span)) continue;
    items.push({
      at: spanBounds(span).from,
      item: {
        uid: `entry:${entry.id}`,
        source: { type: "entry", id: entry.id },
        groupId: entry.groupId,
        kind,
        ...span,
        status: kind === "appointment" && entry.cancelledAt ? "cancelled" : "confirmed",
        recipientName: recipient.displayName,
        title: entry.title?.trim() || null,
        place: kind === "appointment" ? entry.place?.trim() || null : null,
        providers: entry.providers ?? [],
        series:
          entry.seriesId && entry.seriesDay
            ? { id: entry.seriesId, day: entry.seriesDay, detached: entry.seriesDetached }
            : null,
        appUrl: `${base}/app/groups/${entry.groupId}/entries/${entry.id}`,
      },
    });
  }

  for (const task of tasks) {
    if (task.deletedAt || task.doneAt || !task.dueOn) continue;
    const span = taskSpan({ ...task, dueOn: task.dueOn }, recipient.timeZone);
    if (!inWindow(span)) continue;
    items.push({
      at: spanBounds(span).from,
      item: {
        uid: `task:${task.id}`,
        source: { type: "task", id: task.id },
        groupId: task.groupId,
        kind: "task",
        ...span,
        status: "confirmed",
        recipientName: recipient.displayName,
        title: task.title.trim() || null,
        place: null,
        providers: [],
        series: null,
        appUrl: `${base}/app/groups/${task.groupId}/tasks/${task.id}`,
      },
    });
  }

  return items
    .sort((a, b) => a.at - b.at || (a.item.uid < b.item.uid ? -1 : a.item.uid > b.item.uid ? 1 : 0))
    .map(({ item }) => item);
};
