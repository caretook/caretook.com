import type { TaskRuleFields, TaskState } from "@caretook/data/schema";

import { localDate } from "@caretook/data/schema";
import { assigneeLabel, dueText, shortDay } from "../../../../lib/taskDisplay";

// How the task page words a task (pure; web:unit tests it): the header's
// badge, the assignee, the due day and the done-by line. Days and times are
// wall-clock in the recipient's zone, like the list's (`lib/taskDisplay.ts`).

/** The header's badge: "Done" or "Overdue", else none. */
export const taskBadge = (state: TaskState): { label: string; tone: "done" | "overdue" } | null => {
  if (state === "done") return { label: "Done", tone: "done" };
  if (state === "overdue") return { label: "Overdue", tone: "overdue" };
  return null;
};

/** Who it's for: a member ("you" for me), "Aunt May (not in the group)", or "Unassigned (anyone)". */
export const assigneeText = (
  task: Pick<TaskRuleFields, "assigneeId" | "assigneeName">,
  nameOf: (userId: string) => string,
) => {
  const who = assigneeLabel(task, nameOf);
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
  task: Pick<TaskRuleFields, "dueOn" | "dueTime" | "doneAt">,
  now: Date | number,
  timeZone: string,
): { day: string; status: string | null } => {
  if (!task.dueOn) return { day: "No due date", status: null };
  const thisYear = localDate(now, timeZone).slice(0, 4) === task.dueOn.slice(0, 4);
  const day = (thisYear ? longDay : longDayYear).format(UTC(task.dueOn));
  return {
    day: task.dueTime ? `${day} at ${task.dueTime}` : day,
    status: task.doneAt ? null : dueText(task, now, timeZone),
  };
};

/** "Done by Sam Okafor · today at 14:05", "Done by you · Tue at 09:30". None while open. */
export const doneByLine = (
  task: Pick<TaskRuleFields, "doneAt"> & { doneBy: string | null },
  nameOf: (userId: string) => string,
  now: Date | number,
  timeZone: string,
): string | null => {
  if (!task.doneAt) return null;
  const who = task.doneBy ? nameOf(task.doneBy) : "someone";
  const day = shortDay(localDate(task.doneAt, timeZone), localDate(now, timeZone));
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(new Date(task.doneAt));
  return `Done by ${who} · ${day} at ${time}`;
};
