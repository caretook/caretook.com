import type { RepeatRule } from "../appointments/repeatRule";
import type { TodoRuleFields } from "./todoRules";

import { ordinal, parseRule, weekdayName } from "../appointments/repeatRule";
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

// How a repeating todo words its repeat (planner-2), on its page and on
// quick entry's card (planner-3): "Repeats weekly on Monday". The due day
// and time have their own row, so neither is here. The connector's `repeats` is `todoRepeatText` (the series wording).

const endDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const endDayYear = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** "Monday", "Monday and Thursday", "Monday, Wednesday and Friday". */
const listed = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

const pattern = (rule: RepeatRule) => {
  const every = (unit: string, alone: string) =>
    rule.interval === 1 ? alone : `every ${rule.interval} ${unit}s`;
  if (rule.freq === "daily") return every("day", "daily");
  if (rule.freq === "weekly")
    return `${every("week", "weekly")} on ${listed(rule.weekdays.map((d) => weekdayName(d)))}`;
  const on = !rule.monthly
    ? ""
    : rule.monthly.by === "lastDay"
      ? " on the last day"
      : rule.monthly.by === "date"
        ? ` on the ${ordinal(rule.monthly.day)}`
        : ` on the ${rule.monthly.nth === -1 ? "last" : ordinal(rule.monthly.nth)} ${weekdayName(rule.monthly.weekday)}`;
  return `${every("month", "monthly")}${on}`;
};

/**
 * A repeating todo's repeat in words: "Repeats weekly on Monday", "Repeats
 * every 2 weeks on Monday and Thursday", "Repeats monthly on the last
 * Friday · until Jan 31", "Repeats daily · 10 times". Null when it doesn't
 * repeat; "Repeats" for a rule it can't read.
 */
export const todoRepeatLine = (todo: { repeatRule: string | null; repeatStartsOn?: string | null }) => {
  if (!todo.repeatRule) return null;
  const parsed = parseRule(todo.repeatRule);
  if (!parsed.ok) return "Repeats";
  const { rule } = parsed;
  const until = (day: string) =>
    (todo.repeatStartsOn?.slice(0, 4) === day.slice(0, 4) ? endDay : endDayYear).format(
      new Date(`${day}T12:00:00Z`),
    );
  const end =
    rule.end.type === "on"
      ? ` · until ${until(rule.end.until)}`
      : rule.end.type === "after"
        ? ` · ${rule.end.count} time${rule.end.count === 1 ? "" : "s"}`
        : "";
  return `Repeats ${pattern(rule)}${end}`;
};
