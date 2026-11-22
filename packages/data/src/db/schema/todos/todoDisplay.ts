import type { TodoRuleFields } from "./todoRules";

import { localDate } from "../core/entryTiming";
import { assigneeOf, todoState } from "./todoRules";

// How todos are worded (pure; web:unit tests it; the one home for it): the
// due line, the done line, the assignee chip and a link's label. Due days
// and times are wall-clock in the recipient's zone, and so is "today". Times
// are 24-hour, like medication slots.

const DAY_MS = 86_400_000;

/** Whole calendar days from `a` to `b` ("YYYY-MM-DD"). */
const daysBetween = (a: string, b: string) => {
  const day = (d: string) => {
    const [y, m, dd] = d.split("-").map(Number);
    return Date.UTC(y!, m! - 1, dd);
  };
  return Math.round((day(b) - day(a)) / DAY_MS);
};

const weekdayFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const monthDayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const monthDayYearFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const longDayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const asUtc = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d));
};

/** A day near `today`: "today", "tomorrow", "yesterday", a weekday within the week ahead or behind, else "Nov 28" (with the year when it isn't this year's). */
export const shortDay = (date: string, today: string) => {
  const diff = daysBetween(today, date);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (Math.abs(diff) < 7) return weekdayFormat.format(asUtc(date));
  return date.slice(0, 4) === today.slice(0, 4)
    ? monthDayFormat.format(asUtc(date))
    : monthDayYearFormat.format(asUtc(date));
};

/** A section heading for a later day: "Tomorrow", then "Friday, Nov 21". */
export const dayHeading = (date: string, today: string) =>
  daysBetween(today, date) === 1 ? "Tomorrow" : longDayFormat.format(asUtc(date));

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * The due line: "Due today", "Due today 17:00", "Due tomorrow", "Due Fri
 * 14:00", "Due Nov 28", "Overdue · 2 days", "Overdue · since 09:00", "No
 * due date". A done todo has none (see `doneText`).
 */
export const dueText = (
  todo: Pick<TodoRuleFields, "dueOn" | "dueTime" | "doneAt">,
  now: Date | number,
  timeZone: string,
): string | null => {
  const state = todoState(todo, now, timeZone);
  if (state === "done") return null;
  if (state === "undated" || !todo.dueOn) return "No due date";
  const today = localDate(now, timeZone);
  if (state === "overdue") {
    const late = daysBetween(todo.dueOn, today);
    return late > 0 ? `Overdue · ${plural(late, "day")}` : `Overdue · since ${todo.dueTime}`;
  }
  const day = shortDay(todo.dueOn, today);
  return `Due ${day}${todo.dueTime ? ` ${todo.dueTime}` : ""}`;
};

/** "Done by Sam · Tue", "Done by you · today". `nameOf` gives a member's name ("you" for me). */
export const doneText = (
  todo: Pick<TodoRuleFields, "doneAt"> & { doneBy: string | null },
  nameOf: (userId: string) => string,
  now: Date | number,
  timeZone: string,
): string | null => {
  if (!todo.doneAt) return null;
  const who = todo.doneBy ? nameOf(todo.doneBy) : "someone";
  return `Done by ${who} · ${shortDay(localDate(todo.doneAt, timeZone), localDate(now, timeZone))}`;
};

export type AssigneeLabel =
  | { type: "member"; userId: string; label: string }
  | { type: "name"; label: string }
  | { type: "none"; label: string };

/**
 * The assignee chip: a member's name ("you" for me), a typed-in name (shown
 * with a person-outline icon and no link), or "Unassigned".
 */
export const assigneeLabel = (
  todo: Pick<TodoRuleFields, "assigneeId" | "assigneeName">,
  nameOf: (userId: string) => string,
): AssigneeLabel => {
  const who = assigneeOf(todo);
  if (who.type === "member") return { type: "member", userId: who.userId, label: nameOf(who.userId) };
  if (who.type === "name") return { type: "name", label: who.name };
  return { type: "none", label: "Unassigned" };
};

/** A linked provider's or medication's label, greyed "(removed)" when it was deleted. */
export const linkLabel = (name: string, deleted: boolean) => (deleted ? `${name} (removed)` : name);

/** The polite status after a tick: "Done: Call the pharmacy". */
export const completedText = (title: string) => `Done: ${title}`;
