import type { TodoRuleFields } from "@caretook/data/schema";
import type { TodoTree, TreeTodo } from "./todoTreeView";

import { assigneeOf, localDate, todoState } from "@caretook/data/schema";
import { matchingText } from "../core/textFilter";
import { dayHeading } from "./todoDisplay";

// The todo list's shape (pure; web:unit tests it): which todos the
// Everyone / Mine / Unassigned filter shows, its default, and the sections
// of trees (Overdue, Today, a day per later day, No due date) in list order.

/** The "Assigned to" filter's choices, in menu order (Everyone first: the default). */
export const TODO_WHO = ["everyone", "mine", "unassigned"] as const;
export type TodoWho = (typeof TODO_WHO)[number];

export const WHO_LABELS: Record<TodoWho, string> = {
  mine: "Mine",
  unassigned: "Unassigned",
  everyone: "Everyone",
};

/** The filter's URL param. */
export const WHO_PARAM = "who";

/** `?who=` from a search string, or null (none, or unknown). */
export const parseWho = (search: string): TodoWho | null => {
  const value = new URLSearchParams(search).get(WHO_PARAM);
  return (TODO_WHO as readonly (string | null)[]).includes(value) ? (value as TodoWho) : null;
};

/** `search` with the filter set to `who`. */
export const setWho = (search: string, who: TodoWho) => {
  const params = new URLSearchParams(search);
  params.set(WHO_PARAM, who);
  return `?${params.toString()}`;
};

/** `search` without `?who=` (the list's default, Everyone). */
export const clearWho = (search: string) => {
  const params = new URLSearchParams(search);
  params.delete(WHO_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : "";
};

/** The list's quick text filter's URL param (the search box; never a filter in the menu). */
export const TODO_QUERY_PARAM = "q";

/** `?q=` from a search string, trimmed ("" for none). */
export const todoQueryOf = (search: string) =>
  (new URLSearchParams(search).get(TODO_QUERY_PARAM) ?? "").trim();

/** `search` with `q` as its text (trimmed; empty drops `?q=`), the rest kept. */
export const setTodoQuery = (search: string, q: string) => {
  const params = new URLSearchParams(search);
  if (q.trim()) params.set(TODO_QUERY_PARAM, q.trim());
  else params.delete(TODO_QUERY_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : "";
};

const EMPTY_TODOS: Record<TodoWho, string> = {
  mine: "Nothing assigned to you",
  unassigned: "No unassigned todos",
  everyone: "No open todos",
};

/** What an empty open list says, naming the filter, the tag and the text on. */
export const emptyTodosText = (who: TodoWho, q = "", tagName?: string | null) =>
  `${EMPTY_TODOS[who]}${tagName ? ` tagged “${tagName}”` : ""}${matchingText(q)}.`;

/** The filter with no `?who=`: Everyone, always (Mine and Unassigned narrow it). */
export const DEFAULT_WHO: TodoWho = "everyone";

/** The filter in effect: `?who=`, else Everyone. */
export const whoOf = (search: string): TodoWho => parseWho(search) ?? DEFAULT_WHO;

type Assigned = Pick<TodoRuleFields, "assigneeId" | "assigneeName" | "doneAt">;

/**
 * Whether the filter shows a todo. Mine: assigned to me. Unassigned: nobody
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
  trees: TodoTree<T>[];
};

/**
 * Open trees (`todoTrees`, in list order) in sections, each under its lead's
 * (its most urgent open shown todo's) Overdue, Today, day or No due date;
 * empty sections are left out, and so is a tree with nothing open shown. A
 * subtask never sections alone: it's in its tree (todo-subtasks-3).
 */
export const todoSections = <T extends TreeTodo>(
  trees: readonly TodoTree<T>[],
  now: Date | number,
  timeZone: string,
): TodoSection<T>[] => {
  const today = localDate(now, timeZone);
  const sections: TodoSection<T>[] = [];
  for (const tree of trees) {
    if (!tree.lead) continue;
    const state = todoState(tree.lead, now, timeZone);
    const key = state === "upcoming" ? tree.lead.dueOn! : state;
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
      section = { key, label, trees: [] };
      sections.push(section);
    }
    section.trees.push(tree);
  }
  return sections;
};
