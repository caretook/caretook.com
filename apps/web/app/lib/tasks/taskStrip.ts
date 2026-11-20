import type { TaskRuleFields } from "@caretook/data/schema";

import { taskState } from "@caretook/data/schema";

// The timeline's task strip: one line, there while the group has open tasks
// overdue or due today. Which task it names (`taskStrip`) and what it says
// (`taskStripText`). It counts the whole group's tasks; mine come first in
// the wording. Pure; web:unit tests it.

/** `overdue`: red, something is late; `today`: amber, due today and nothing late. */
export type TaskStripState = "overdue" | "today";

export type TaskStrip<T extends TaskRuleFields = TaskRuleFields> = {
  state: TaskStripState;
  /** The task the line names. */
  task: T;
  /** Whether it's assigned to me (the link then opens the list on Mine). */
  mine: boolean;
  /** Other open tasks overdue or due today. */
  more: number;
  /** How many open tasks are overdue (the named one among them when `state` is `overdue`). */
  overdue: number;
};

/**
 * The task the strip names, from the group's open tasks in `taskOrder`: the
 * first overdue one (mine first), else the first due today (mine first).
 * Null when nothing is overdue or due today.
 */
export function taskStrip<T extends TaskRuleFields>(
  tasks: readonly T[],
  now: Date | number,
  timeZone: string,
  userId: string,
): TaskStrip<T> | null {
  const overdue: T[] = [];
  const today: T[] = [];
  for (const task of tasks) {
    const state = taskState(task, now, timeZone);
    if (state === "overdue") overdue.push(task);
    else if (state === "today") today.push(task);
  }
  const pool = overdue.length ? overdue : today;
  const isMine = (t: T) => !!userId && t.assigneeId === userId;
  const task = pool.find(isMine) ?? pool[0];
  if (!task) return null;
  return {
    state: overdue.length ? "overdue" : "today",
    task,
    mine: isMine(task),
    more: overdue.length + today.length - 1,
    overdue: overdue.length,
  };
}

const LEAD: Record<TaskStripState, string> = { overdue: "Overdue", today: "Today" };

/**
 * The strip's words, in parts: the lead ("Overdue", "Today"), the task's
 * title (the link) and the rest ("+2 more", or null). `text` is the whole
 * line: "Overdue: Call pharmacy · +2 more", "Today: Pick up walker".
 */
export function taskStripText({
  state,
  task,
  more,
}: {
  state: TaskStripState;
  task: { title: string };
  more: number;
}) {
  const lead = LEAD[state];
  const rest = more > 0 ? `+${more} more` : null;
  return { lead, title: task.title, rest, text: `${lead}: ${task.title}${rest ? ` · ${rest}` : ""}` };
}

/** The Tasks list's chip the strip opens on: Mine when the named task is mine, else Everyone (so it's there). */
export const taskStripWho = (strip: Pick<TaskStrip, "mine">) => (strip.mine ? "mine" : "everyone");
