import type { TimelineEntry } from "../../db/schema/timeline/timelineEntry";
import type { Todo } from "../../db/schema/todos/todo";

import { addDays, dayStart, localDate } from "../core/entryTiming";
import { zonedInstant } from "../core/zonedDay";

// One projection of a care group's calendar (appointments-2), shared by the
// iCal feed, reminder emails and Google Calendar: appointments (events) and
// open todos with a due day, as neutral
// `CalendarItem`s. Pure and client-safe. Wording is `calendarText`'s, and how
// much of an item may leave is `shareLevel`'s; nothing here reads a note's
// body or live notes, so no note content can leave through it.

/** How far back and ahead the feed, the Planner and reminders look. */
export const CALENDAR_WINDOW_DAYS = 90;
/** How far ahead Google sync looks (specialist visits are booked months out); it looks back as far as the rest. */
export const GOOGLE_WINDOW_AHEAD_DAYS = 365;

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/** The window around `now`: 90 days back to 90 days ahead, as `[from, to)`. */
export const calendarWindow = (now: Date) => ({
  from: new Date(now.getTime() - CALENDAR_WINDOW_DAYS * DAY_MS),
  to: new Date(now.getTime() + CALENDAR_WINDOW_DAYS * DAY_MS),
});

/** Google push and pull's horizon around `now`: 90 days back to 365 days ahead, as `[from, to)`. */
export const googleWindow = (now: Date) => ({
  from: calendarWindow(now).from,
  to: new Date(now.getTime() + GOOGLE_WINDOW_AHEAD_DAYS * DAY_MS),
});

/**
 * How long an item lasts when nothing says: an appointment without an end
 * an hour, a timed todo half an hour (calendars need an end).
 */
export const DEFAULT_ITEM_MINUTES = { appointment: 60, todo: 30 } as const;

export const CALENDAR_ITEM_KINDS = ["appointment", "todo"] as const;
export type CalendarItemKind = (typeof CALENDAR_ITEM_KINDS)[number];

export type CalendarItemStatus = "confirmed" | "cancelled";

export type CalendarItem = {
  /** Stable per entry or todo: `entry:<id>` or `todo:<id>`. */
  uid: string;
  source: { type: "entry" | "todo"; id: string };
  groupId: string;
  kind: CalendarItemKind;
  /**
   * All-day: `start` and `end` are days ("YYYY-MM-DD", the end exclusive).
   * Otherwise ISO 8601 instants (UTC).
   */
  allDay: boolean;
  start: string;
  end: string;
  /** The zone its day and times are read in: the entry's own, or the recipient's for a todo. */
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

export type CalendarTodoInput = Pick<
  Todo,
  "id" | "groupId" | "title" | "dueOn" | "dueTime" | "doneAt" | "deletedAt"
>;

export type CalendarItemsArgs = {
  entries: readonly CalendarEntryInput[];
  todos: readonly CalendarTodoInput[];
  /** The care recipient: their name for the wording, and their zone for todos' due days and times. */
  recipient: { displayName: string; timeZone: string };
  from: Date;
  to: Date;
  /** The app's origin (`APP_URL`), for each item's link. */
  appUrl: string;
};

const iso = (value: string | number | Date) => new Date(value).toISOString();
const ms = (value: string | number | Date) => new Date(value).getTime();

/** Only an event is an appointment: a note, past or future, never gives an item. */
const entryKind = (entry: CalendarEntryInput): CalendarItemKind | null =>
  entry.kind === "event" ? "appointment" : null;

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

const entrySpan = (entry: CalendarEntryInput): Span => {
  if (entry.allDay) return daySpan(localDate(entry.occurredAt, entry.timeZone), entry.timeZone);
  const start = ms(entry.occurredAt);
  const end = entry.endsAt ? ms(entry.endsAt) : start + DEFAULT_ITEM_MINUTES.appointment * MINUTE_MS;
  return timedSpan(start, end, entry.timeZone);
};

const todoSpan = (todo: CalendarTodoInput & { dueOn: string }, timeZone: string): Span => {
  if (!todo.dueTime) return daySpan(todo.dueOn, timeZone);
  const start = zonedInstant(todo.dueOn, todo.dueTime, timeZone).getTime();
  return timedSpan(start, start + DEFAULT_ITEM_MINUTES.todo * MINUTE_MS, timeZone);
};

/** The instants a span covers, `[from, to)`. */
const spanBounds = (span: Span) =>
  span.allDay
    ? { from: dayStart(span.start, span.timeZone), to: dayStart(span.end, span.timeZone) }
    : { from: ms(span.start), to: ms(span.end) };

const trimSlash = (url: string) => url.replace(/\/+$/, "");

/**
 * A group's calendar between `from` and `to`: appointments (cancelled ones
 * kept, marked cancelled), and open todos with a due day, each
 * overlapping the window. Deleted entries and todos, done todos and undated
 * todos are left out. Soonest first.
 */
export const calendarItems = ({
  entries,
  todos,
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
    const span = entrySpan(entry);
    if (!inWindow(span)) continue;
    items.push({
      at: spanBounds(span).from,
      item: {
        uid: `entry:${entry.id}`,
        source: { type: "entry", id: entry.id },
        groupId: entry.groupId,
        kind,
        ...span,
        status: entry.cancelledAt ? "cancelled" : "confirmed",
        recipientName: recipient.displayName,
        title: entry.title?.trim() || null,
        place: entry.place?.trim() || null,
        providers: entry.providers ?? [],
        series:
          entry.seriesId && entry.seriesDay
            ? { id: entry.seriesId, day: entry.seriesDay, detached: entry.seriesDetached }
            : null,
        appUrl: `${base}/app/groups/${entry.groupId}/entries/${entry.id}`,
      },
    });
  }

  for (const todo of todos) {
    if (todo.deletedAt || todo.doneAt || !todo.dueOn) continue;
    const span = todoSpan({ ...todo, dueOn: todo.dueOn }, recipient.timeZone);
    if (!inWindow(span)) continue;
    items.push({
      at: spanBounds(span).from,
      item: {
        uid: `todo:${todo.id}`,
        source: { type: "todo", id: todo.id },
        groupId: todo.groupId,
        kind: "todo",
        ...span,
        status: "confirmed",
        recipientName: recipient.displayName,
        title: todo.title.trim() || null,
        place: null,
        providers: [],
        series: null,
        appUrl: `${base}/app/groups/${todo.groupId}/todos/${todo.id}`,
      },
    });
  }

  return items
    .sort((a, b) => a.at - b.at || (a.item.uid < b.item.uid ? -1 : a.item.uid > b.item.uid ? 1 : 0))
    .map(({ item }) => item);
};
