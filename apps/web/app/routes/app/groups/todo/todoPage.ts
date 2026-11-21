import type { TodoRuleFields, TodoState } from "@caretook/data/schema";

import { localDate } from "@caretook/data/schema";
import { assigneeLabel, dueText, shortDay } from "../../../../lib/todos/todoDisplay";

// How the todo page words a todo (pure; web:unit tests it): the header's
// badge, the assignee, the due day and the done-by line. Days and times are
// wall-clock in the recipient's zone, like the list's (`lib/todos/todoDisplay.ts`).

/** The header's badge: "Done" or "Overdue", else none. */
export const todoBadge = (state: TodoState): { label: string; tone: "done" | "overdue" } | null => {
  if (state === "done") return { label: "Done", tone: "done" };
  if (state === "overdue") return { label: "Overdue", tone: "overdue" };
  return null;
};

/** Who it's for: a member ("you" for me), "Aunt May (not in the group)", or "Unassigned (anyone)". */
export const assigneeText = (
  todo: Pick<TodoRuleFields, "assigneeId" | "assigneeName">,
  nameOf: (userId: string) => string,
) => {
  const who = assigneeLabel(todo, nameOf);
  if (who.type === "name") return `${who.label} (not in the group)`;
  if (who.type === "none") return "Unassigned (anyone)";
  return who.label;
};

const UTC = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d));
};
const longDay = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const longDayYear = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * The due row: the day in full ("Friday, Nov 21 at 17:00", with the year
 * when it isn't this year's) and, while open, the list's due line ("Due
 * tomorrow 17:00", "Overdue · 2 days"). Undated: "No due date" alone.
 */
export const dueLines = (
  todo: Pick<TodoRuleFields, "dueOn" | "dueTime" | "doneAt">,
  now: Date | number,
  timeZone: string,
): { day: string; status: string | null } => {
  if (!todo.dueOn) return { day: "No due date", status: null };
  const thisYear = localDate(now, timeZone).slice(0, 4) === todo.dueOn.slice(0, 4);
  const day = (thisYear ? longDay : longDayYear).format(UTC(todo.dueOn));
  return {
    day: todo.dueTime ? `${day} at ${todo.dueTime}` : day,
    status: todo.doneAt ? null : dueText(todo, now, timeZone),
  };
};

/** "Done by Sam Okafor · today at 14:05", "Done by you · Tue at 09:30". None while open. */
export const doneByLine = (
  todo: Pick<TodoRuleFields, "doneAt"> & { doneBy: string | null },
  nameOf: (userId: string) => string,
  now: Date | number,
  timeZone: string,
): string | null => {
  if (!todo.doneAt) return null;
  const who = todo.doneBy ? nameOf(todo.doneBy) : "someone";
  const day = shortDay(localDate(todo.doneAt, timeZone), localDate(now, timeZone));
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(new Date(todo.doneAt));
  return `Done by ${who} · ${day} at ${time}`;
};
