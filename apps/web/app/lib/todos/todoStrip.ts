import type { TodoRuleFields } from "@caretook/data/schema";

import { todoState } from "@caretook/data/schema";

// The timeline's todo strip: one line, there while the group has open todos
// overdue or due today. Which todo it names (`todoStrip`) and what it says
// (`todoStripText`). It counts the whole group's todos; mine come first in
// the wording. Pure; web:unit tests it.

/** `overdue`: red, something is late; `today`: amber, due today and nothing late. */
export type TodoStripState = "overdue" | "today";

export type TodoStrip<T extends TodoRuleFields = TodoRuleFields> = {
  state: TodoStripState;
  /** The todo the line names. */
  todo: T;
  /** Whether it's assigned to me (the link then opens the list on Mine). */
  mine: boolean;
  /** Other open todos overdue or due today. */
  more: number;
  /** How many open todos are overdue (the named one among them when `state` is `overdue`). */
  overdue: number;
};

/**
 * The todo the strip names, from the group's open todos in `todoOrder`: the
 * first overdue one (mine first), else the first due today (mine first).
 * Null when nothing is overdue or due today.
 */
export function todoStrip<T extends TodoRuleFields>(
  todos: readonly T[],
  now: Date | number,
  timeZone: string,
  userId: string,
): TodoStrip<T> | null {
  const overdue: T[] = [];
  const today: T[] = [];
  for (const todo of todos) {
    const state = todoState(todo, now, timeZone);
    if (state === "overdue") overdue.push(todo);
    else if (state === "today") today.push(todo);
  }
  const pool = overdue.length ? overdue : today;
  const isMine = (t: T) => !!userId && t.assigneeId === userId;
  const todo = pool.find(isMine) ?? pool[0];
  if (!todo) return null;
  return {
    state: overdue.length ? "overdue" : "today",
    todo,
    mine: isMine(todo),
    more: overdue.length + today.length - 1,
    overdue: overdue.length,
  };
}

const LEAD: Record<TodoStripState, string> = { overdue: "Overdue", today: "Today" };

/**
 * The strip's words, in parts: the lead ("Overdue", "Today"), the todo's
 * title (the link) and the rest ("+2 more", or null). `text` is the whole
 * line: "Overdue: Call pharmacy · +2 more", "Today: Pick up walker".
 */
export function todoStripText({
  state,
  todo,
  more,
}: {
  state: TodoStripState;
  todo: { title: string };
  more: number;
}) {
  const lead = LEAD[state];
  const rest = more > 0 ? `+${more} more` : null;
  return { lead, title: todo.title, rest, text: `${lead}: ${todo.title}${rest ? ` · ${rest}` : ""}` };
}

/** The Todos list's chip the strip opens on: Mine when the named todo is mine, else Everyone (so it's there). */
export const todoStripWho = (strip: Pick<TodoStrip, "mine">) => (strip.mine ? "mine" : "everyone");
