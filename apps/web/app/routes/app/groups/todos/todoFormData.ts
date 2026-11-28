import type { RepeatChoice } from "~/lib/appointments/repeatChoice";
import type { TodoInput } from "~/lib/todos/todos.sync";

import { choiceOfRule, choiceRule } from "../../../../lib/appointments/repeatChoice";
import { parseRule, ruleText } from "@caretook/data/domain";

// The todo sheet's form (pure; web:unit tests it): its field names, and the
// posted form as a write's input. Empty fields mean none.

export const FIELD = {
  title: "title",
  assigneeId: "assigneeId",
  assigneeName: "assigneeName",
  dueOn: "dueOn",
  dueTime: "dueTime",
  providerId: "providerId",
  medicationId: "medicationId",
  repeatRule: "repeatRule",
  /**
   * The notes and events the todo links (todo-links), repeated hidden
   * fields; the form sends one empty one with the list, so the field
   * present means "these and no others".
   */
  entryIds: "entryIds",
  /** An edited todo's notes and events this sheet linked (B-990), repeated; none sent, none. */
  addEntryIds: "addEntryIds",
  /** An edited todo's notes and events this sheet unlinked (B-990), repeated. */
  removeEntryIds: "removeEntryIds",
} as const;

/** The fields the form shows issues on; anything else is the form's general message. */
export const isFieldIssue = (path: string) => (Object.values(FIELD) as string[]).includes(path);

const value = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

/** The posted ids in the repeated field `name`, once each, empty ones left out. */
const idsOf = (form: FormData, name: string) => [
  ...new Set(form.getAll(name).flatMap((v) => (typeof v === "string" && v.trim() ? [v.trim()] : []))),
];

/**
 * The form as a create or update. A time without a day is kept, so the
 * schema can say so. `entryIds` (a new todo's) only when the form sent the
 * list; `addEntryIds` and `removeEntryIds` (an edit's own changes) only
 * when there are some.
 */
export const todoFromForm = (form: FormData): TodoInput => ({
  title: typeof form.get(FIELD.title) === "string" ? (form.get(FIELD.title) as string) : "",
  assigneeId: value(form, FIELD.assigneeId),
  assigneeName: value(form, FIELD.assigneeName),
  dueOn: value(form, FIELD.dueOn),
  dueTime: value(form, FIELD.dueTime),
  providerId: value(form, FIELD.providerId),
  medicationId: value(form, FIELD.medicationId),
  repeatRule: value(form, FIELD.repeatRule),
  // No field at all: none given, so an edit leaves the links alone.
  ...(form.has(FIELD.entryIds) ? { entryIds: idsOf(form, FIELD.entryIds) } : {}),
  ...(idsOf(form, FIELD.addEntryIds).length ? { addEntryIds: idsOf(form, FIELD.addEntryIds) } : {}),
  ...(idsOf(form, FIELD.removeEntryIds).length ? { removeEntryIds: idsOf(form, FIELD.removeEntryIds) } : {}),
});

// --- The repeat (planner-2) --------------------------------------------------

/** The form's repeat: the sheet's choice, the rule it made and the due day it was made for. None: null. */
export type TodoRepeatDraft = { choice: RepeatChoice; rule: string; day: string } | null;

/** An edited todo's repeat as the form starts: its stored rule, as is. */
export const initialRepeat = (
  todo: { repeatRule: string | null; dueOn: string | null } | undefined,
): TodoRepeatDraft =>
  todo?.repeatRule && todo.dueOn
    ? { choice: choiceOfRule(todo.repeatRule, todo.dueOn), rule: todo.repeatRule, day: todo.dueOn }
    : null;

/**
 * A new todo's repeat from a prefill (quick entry's Edit, planner-3): the
 * rule on its due day, or none without a day or for a rule that doesn't
 * parse (the form then opens with no repeat).
 */
export const prefillRepeat = (
  rule: string | null | undefined,
  day: string | null | undefined,
): TodoRepeatDraft =>
  rule && day && parseRule(rule).ok ? initialRepeat({ repeatRule: rule, dueOn: day }) : null;

/**
 * The repeat after the due day changes: none without a day (Repeat needs
 * one), as it was on the same day, else the choice's rule for the new day
 * (a monthly date or weekday follows the day).
 */
export const repeatOnDay = (draft: TodoRepeatDraft, day: string): TodoRepeatDraft => {
  if (!draft || !day) return null;
  if (draft.day === day) return draft;
  const rule = choiceRule(draft.choice, day);
  return rule ? { choice: draft.choice, rule: ruleText(rule), day } : null;
};
