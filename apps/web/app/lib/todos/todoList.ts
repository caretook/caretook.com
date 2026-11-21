import type { TodoRuleFields } from "@caretook/data/schema";

import { assigneeOf, localDate, todoOrder, todoState } from "@caretook/data/schema";
import { dayHeading } from "./todoDisplay";

// The todo list's shape (pure; web:unit tests it): which todos the
// Mine / Unassigned / Everyone chip shows, its default, and the sections
// (Overdue, Today, a day per later day, No due date) in list order.

export const TODO_WHO = ["mine", "unassigned", "everyone"] as const;
export type TodoWho = (typeof TODO_WHO)[number];

export const WHO_LABELS: Record<TodoWho, string> = {
  mine: "Mine",
  unassigned: "Unassigned",
  everyone: "Everyone",
};

/** The chip's URL param. */
export const WHO_PARAM = "who";

/** `?who=` from a search string, or null (none, or unknown). */
export const parseWho = (search: string): TodoWho | null => {
  const value = new URLSearchParams(search).get(WHO_PARAM);
  return (TODO_WHO as readonly (string | null)[]).includes(value) ? (value as TodoWho) : null;
};

/** `search` with the chip set to `who`. */
export const setWho = (search: string, who: TodoWho) => {
  const params = new URLSearchParams(search);
  params.set(WHO_PARAM, who);
  return `?${params.toString()}`;
};

type Assigned = Pick<TodoRuleFields, "assigneeId" | "assigneeName" | "doneAt">;

/** The chip with no `?who=`: Mine when I have open todos, else Everyone. */
export const defaultWho = (todos: readonly Assigned[], userId: string): TodoWho =>
  todos.some((t) => !t.doneAt && t.assigneeId === userId) ? "mine" : "everyone";

/**
 * Whether the chip shows a todo. Mine: assigned to me. Unassigned: nobody
 * (a typed-in name's todo isn't up for grabs, so it's under Everyone only).
 */
export const showsTodo = (who: TodoWho, todo: Assigned, userId: string) => {
  if (who === "everyone") return true;
  const assignee = assigneeOf(todo);
  if (who === "mine") return assignee.type === "member" && assignee.userId === userId;
  return assignee.type === "none";
};

export type TodoSection<T> = {
  /** "overdue", "today", "YYYY-MM-DD" (a later day) or "undated". */
  key: string;
  label: string;
  todos: T[];
};

/** Open todos in sections, in list order (`todoOrder`); empty sections are left out. */
export const todoSections = <T extends TodoRuleFields>(
  todos: readonly T[],
  now: Date | number,
  timeZone: string,
): TodoSection<T>[] => {
  const today = localDate(now, timeZone);
  const sections: TodoSection<T>[] = [];
  for (const todo of todoOrder(
    todos.filter((t) => !t.doneAt),
    now,
    timeZone,
  )) {
    const state = todoState(todo, now, timeZone);
    const key = state === "upcoming" ? todo.dueOn! : state;
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
      section = { key, label, todos: [] };
      sections.push(section);
    }
    section.todos.push(todo);
  }
  return sections;
};
