import type { TodoRuleFields } from "@caretook/data/schema";

import { dueText, todoOrder } from "@caretook/data/schema";
import { matchesText, textTokens } from "../core/textFilter";

// The entry page's Link a todo picker (planner-3), its pure part: which
// todos it offers for the typed text. No React or database; unit-tested in
// web:unit (so imports stay relative).

export type PickerTodo = TodoRuleFields & { title: string; deletedAt: string | null };

export type TodoPickerOption = { id: string; label: string; description: string };

/** How many choices the picker lists at most. */
export const TODO_PICKER_LIMIT = 20;

/**
 * The picker's choices for `text`: the group's open, live todos not linked to
 * this entry already, whose title has every typed word (case and accents
 * ignored), in list order (`todoOrder`: overdue, today, later, undated), at
 * most `limit`. Each says when it's due ("Due tomorrow", "No due date").
 */
export const todoPickerOptions = (
  todos: readonly PickerTodo[],
  linked: ReadonlySet<string>,
  text: string,
  now: Date | number,
  timeZone: string,
  limit = TODO_PICKER_LIMIT,
): TodoPickerOption[] => {
  const tokens = textTokens(text);
  const open = todos.filter(
    (t) => !t.doneAt && !t.deletedAt && !linked.has(t.id) && matchesText(tokens, t.title),
  );
  return todoOrder(open, now, timeZone)
    .slice(0, limit)
    .map((t) => ({ id: t.id, label: t.title, description: dueText(t, now, timeZone) ?? "" }));
};
