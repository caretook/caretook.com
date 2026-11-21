import type { TodoRuleFields } from "@caretook/data/schema";

import { assigneeOf, localDate, todoOrder, todoState } from "@caretook/data/schema";
import { dayHeading } from "./taskDisplay";

// The task list's shape (pure; web:unit tests it): which tasks the
// Mine / Unassigned / Everyone chip shows, its default, and the sections
// (Overdue, Today, a day per later day, No due date) in list order.

export const TASK_WHO = ["mine", "unassigned", "everyone"] as const;
export type TaskWho = (typeof TASK_WHO)[number];

export const WHO_LABELS: Record<TaskWho, string> = {
  mine: "Mine",
  unassigned: "Unassigned",
  everyone: "Everyone",
};

/** The chip's URL param. */
export const WHO_PARAM = "who";

/** `?who=` from a search string, or null (none, or unknown). */
export const parseWho = (search: string): TaskWho | null => {
  const value = new URLSearchParams(search).get(WHO_PARAM);
  return (TASK_WHO as readonly (string | null)[]).includes(value) ? (value as TaskWho) : null;
};

/** `search` with the chip set to `who`. */
export const setWho = (search: string, who: TaskWho) => {
  const params = new URLSearchParams(search);
  params.set(WHO_PARAM, who);
  return `?${params.toString()}`;
};

type Assigned = Pick<TodoRuleFields, "assigneeId" | "assigneeName" | "doneAt">;

/** The chip with no `?who=`: Mine when I have open tasks, else Everyone. */
export const defaultWho = (tasks: readonly Assigned[], userId: string): TaskWho =>
  tasks.some((t) => !t.doneAt && t.assigneeId === userId) ? "mine" : "everyone";

/**
 * Whether the chip shows a task. Mine: assigned to me. Unassigned: nobody
 * (a typed-in name's task isn't up for grabs, so it's under Everyone only).
 */
export const showsTask = (who: TaskWho, task: Assigned, userId: string) => {
  if (who === "everyone") return true;
  const assignee = assigneeOf(task);
  if (who === "mine") return assignee.type === "member" && assignee.userId === userId;
  return assignee.type === "none";
};

export type TaskSection<T> = {
  /** "overdue", "today", "YYYY-MM-DD" (a later day) or "undated". */
  key: string;
  label: string;
  tasks: T[];
};

/** Open tasks in sections, in list order (`todoOrder`); empty sections are left out. */
export const taskSections = <T extends TodoRuleFields>(
  tasks: readonly T[],
  now: Date | number,
  timeZone: string,
): TaskSection<T>[] => {
  const today = localDate(now, timeZone);
  const sections: TaskSection<T>[] = [];
  for (const task of todoOrder(
    tasks.filter((t) => !t.doneAt),
    now,
    timeZone,
  )) {
    const state = todoState(task, now, timeZone);
    const key = state === "upcoming" ? task.dueOn! : state;
    let section = sections.at(-1);
    if (section?.key !== key) {
      const label =
        state === "overdue"
          ? "Overdue"
          : state === "today"
            ? "Today"
            : state === "undated"
              ? "No due date"
              : dayHeading(key, today);
      section = { key, label, tasks: [] };
      sections.push(section);
    }
    section.tasks.push(task);
  }
  return sections;
};
