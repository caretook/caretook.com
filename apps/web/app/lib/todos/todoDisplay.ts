import type { RepeatRule } from "@caretook/data/schema";

import { ordinal, parseRule, weekdayName } from "@caretook/data/schema";

// Moved to @caretook/data/schema (shared with the connector); this keeps the old import path.
export type { AssigneeLabel } from "@caretook/data/schema";
export {
  assigneeLabel,
  completedText,
  dayHeading,
  doneText,
  dueText,
  linkLabel,
  shortDay,
} from "@caretook/data/schema";

// How a repeating todo words its repeat (planner-2), on its page: "Repeats
// weekly on Monday". The due day and time have their own row, so neither is
// here. The connector's `repeats` is `todoRepeatText` (the series wording).

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
