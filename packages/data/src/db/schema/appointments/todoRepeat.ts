// Repeating todos (planner-2): a repeating todo is one open row, and ticking
// (or skipping) it makes the next. Pure and client-safe, but in the
// `@caretook/data/series` entry beside `seriesVisits`, never the schema index:
// it expands the rule with rrule, which stays out of the first-load bundle.
//
// The next due day is the first rule day after both the todo's due day and
// today (in the recipient's zone), so a tick three weeks late brings the next
// one on the next rule day ahead, not three overdue copies. The rule is
// anchored on `repeat_starts_on` (the chain's first due day): "every 2 weeks"
// and COUNT count from there. The next occurrence's id is the UUID v5 of the
// chain and its day, so a device and the server making it land on one row.

import { addDays } from "../core/entryTiming";
import { uuidV5 } from "../core/uuidV5";
import { firstDayFrom } from "./seriesVisits";

/** The namespace for later occurrences' ids (a fixed, random UUID; never change it). */
export const TODO_REPEAT_NAMESPACE = "8d2f4c71-5b3e-4a96-b0d8-2e7a1c9f6b45";

/**
 * The first day ("YYYY-MM-DD") the rule falls on after both `dueOn` and
 * `today`, counting from its anchor `startsOn`; null when the rule has ended
 * (COUNT or UNTIL), or can't be read. However far off: no search horizon, so
 * a long interval ("every 99 months") keeps going.
 */
export const nextDueDay = (rule: string, startsOn: string, dueOn: string, today: string) => {
  const after = dueOn > today ? dueOn : today;
  return firstDayFrom({ rule, startsOn }, addDays(after, 1));
};

/** A later occurrence's id: the version 5 UUID of its chain and its due day. */
export const nextTodoId = (repeatId: string, day: string) =>
  uuidV5(`${repeatId.toLowerCase()}:${day}`, TODO_REPEAT_NAMESPACE);

/** What making the next occurrence reads of a todo (rows from Postgres and the device both fit). */
export type RepeatingTodoFields = {
  groupId: string;
  recipientId: string;
  title: string;
  assigneeId: string | null;
  assigneeName: string | null;
  dueOn: string | null;
  dueTime: string | null;
  providerId: string | null;
  medicationId: string | null;
  repeatRule: string | null;
  repeatStartsOn: string | null;
  repeatId: string | null;
};

/** A later occurrence's columns: open, with its own id and day, and the chain's repeat. */
export type TodoOccurrence = {
  id: string;
  groupId: string;
  recipientId: string;
  title: string;
  assigneeId: string | null;
  assigneeName: string | null;
  dueOn: string;
  dueTime: string | null;
  providerId: string | null;
  medicationId: string | null;
  eventId: null;
  doneAt: null;
  doneBy: null;
  deletedAt: null;
  repeatRule: string;
  repeatStartsOn: string;
  repeatId: string;
};

/**
 * The occurrence of `todo`'s chain on `day`: its title, assignee, due time,
 * provider and medication links and repeat, never its appointment link,
 * notes or done state. Null when `todo` doesn't repeat.
 */
export const occurrenceOn = (todo: RepeatingTodoFields, day: string): TodoOccurrence | null => {
  if (!todo.repeatRule || !todo.repeatStartsOn || !todo.repeatId) return null;
  return {
    id: nextTodoId(todo.repeatId, day),
    groupId: todo.groupId,
    recipientId: todo.recipientId,
    title: todo.title,
    assigneeId: todo.assigneeId,
    assigneeName: todo.assigneeName,
    dueOn: day,
    dueTime: todo.dueTime,
    providerId: todo.providerId,
    medicationId: todo.medicationId,
    eventId: null,
    doneAt: null,
    doneBy: null,
    deletedAt: null,
    repeatRule: todo.repeatRule,
    repeatStartsOn: todo.repeatStartsOn,
    repeatId: todo.repeatId,
  };
};

/**
 * The todo that follows `todo` when it's ticked or skipped `today` (the
 * recipient's day): on `nextDueDay`, or null when it doesn't repeat, has no
 * due day, or its rule has ended.
 *
 * A day whose id is `todo`'s own (a successor moved back onto its source's
 * day keeps the id of the day it was made for) or one in `passOver` (the
 * caller's done rows: a successor moved off its day and ticked) is passed
 * over for the rule's following day (B-386), so the chain goes on and a
 * device and the server, passing over the same rows, make the same one.
 */
export const nextOccurrence = (
  todo: RepeatingTodoFields & { id?: string },
  today: string,
  passOver: ReadonlySet<string> = new Set(),
): TodoOccurrence | null => {
  const { repeatRule: rule, repeatStartsOn: startsOn, repeatId, dueOn } = todo;
  if (!rule || !startsOn || !repeatId || !dueOn) return null;
  let day = nextDueDay(rule, startsOn, dueOn, today);
  // Each pass skips a distinct id (the days only go forward), so this ends.
  for (let passes = 0; day && passes <= passOver.size + 1; passes++) {
    const id = nextTodoId(repeatId, day);
    if (id !== todo.id && !passOver.has(id)) return occurrenceOn(todo, day);
    day = nextDueDay(rule, startsOn, day, day);
  }
  return null;
};

/** A later row of a chain, as `isUntouchedNext` compares it. */
export type ChainRow = Omit<RepeatingTodoFields, "groupId" | "recipientId"> & {
  id: string;
  doneAt: string | null;
  deletedAt: string | null;
};

/**
 * Whether `next` is still exactly what ticking `todo` made: open, live, and
 * every column as `todo`'s occurrence on its day would have it (so nobody
 * edited it). Reopening `todo` takes such a one away; one with notes or a
 * link to a timeline entry (`timeline_entry_todo`) is touched too, which
 * the caller checks (it needs those tables).
 */
export const isUntouchedNext = (todo: RepeatingTodoFields, next: ChainRow) => {
  if (next.doneAt || next.deletedAt || !next.dueOn) return false;
  const made = occurrenceOn(todo, next.dueOn);
  if (!made) return false;
  return (
    made.id === next.id &&
    made.title === next.title &&
    made.assigneeId === next.assigneeId &&
    made.assigneeName === next.assigneeName &&
    made.dueTime === next.dueTime &&
    made.providerId === next.providerId &&
    made.medicationId === next.medicationId &&
    made.repeatRule === next.repeatRule &&
    made.repeatStartsOn === next.repeatStartsOn &&
    made.repeatId === next.repeatId
  );
};
