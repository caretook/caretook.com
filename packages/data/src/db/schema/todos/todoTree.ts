import { assigneeOf } from "./todoRules";

// Subtasks' pure rules (todo-subtasks, client-safe): a subtask is a todo with
// a `parent_id`. The one place that says how deep the tree goes, which todo
// may take a subtask, how a parent follows its children (the rollup), how
// far along it is, and a subtask's due (never after its parent's). The service and
// the device both call these; neither re-derives them.

/** The deepest a todo sits: a todo, its subtasks, and theirs. */
export const MAX_TODO_DEPTH = 3;

/** What a tree rule needs of a todo. Rows from Postgres and the device both fit. */
export type TodoTreeFields = {
  parentId?: string | null;
  doneAt: string | null;
  deletedAt?: string | null;
  repeatRule?: string | null;
};

/**
 * A todo's depth from its ancestor chain (its parent, its parent's parent,
 * …, up to the top): a top-level todo is 1, its subtask 2.
 */
export const depthOf = (ancestors: readonly unknown[]) => ancestors.length + 1;

/**
 * Whether `parent` (with its own ancestor chain) may take a new subtask: it
 * is live, doesn't repeat, and the subtask would be within `MAX_TODO_DEPTH`.
 */
export const canHaveSubtask = (
  parentAncestors: readonly unknown[],
  parent: Pick<TodoTreeFields, "deletedAt" | "repeatRule">,
) => !parent.deletedAt && !parent.repeatRule && depthOf(parentAncestors) < MAX_TODO_DEPTH;

const liveOnly = <T extends Pick<TodoTreeFields, "deletedAt">>(children: readonly T[]) =>
  children.filter((c) => !c.deletedAt);

export type Rollup = "complete" | "reopen";

/**
 * What a parent's children make of it: `complete` when every live child is
 * done and it's open, `reopen` when one is open and it's done, else null.
 * Deleted children don't count, and with no live child the parent is left
 * as it is. Decided by the children alone, so it's idempotent.
 */
export const rollupOf = (
  parent: Pick<TodoTreeFields, "doneAt">,
  children: readonly Pick<TodoTreeFields, "doneAt" | "deletedAt">[],
): Rollup | null => {
  const live = liveOnly(children);
  if (!live.length) return null;
  const allDone = live.every((c) => !!c.doneAt);
  if (allDone && !parent.doneAt) return "complete";
  if (!allDone && parent.doneAt) return "reopen";
  return null;
};

/** How far along a parent is: its live children, and how many are done. */
export const subtaskProgress = (children: readonly Pick<TodoTreeFields, "doneAt" | "deletedAt">[]) => {
  const live = liveOnly(children);
  return { done: live.filter((c) => !!c.doneAt).length, total: live.length };
};

/** A todo's due day and time, as the due rules read them. */
export type DueFields = { dueOn: string | null; dueTime: string | null };

/**
 * The due a new subtask takes when none is given (todo-subtasks-3): its
 * parent's day and time. Under an undated parent, none.
 */
export const inheritedDue = (parent: DueFields | null | undefined): DueFields =>
  parent?.dueOn ? { dueOn: parent.dueOn, dueTime: parent.dueTime } : { dueOn: null, dueTime: null };

/** Whether `due` falls on a day after its parent's (an undated one, or an undated parent, never does). */
export const isDueAfterParent = (due: DueFields, parent: DueFields | null | undefined) =>
  !!parent?.dueOn && !!due.dueOn && due.dueOn > parent.dueOn;

/**
 * A subtask's due, never after its parent's day (todo-subtasks-3): one on
 * a later day is capped at the parent's day and takes its time; one on the
 * same day or earlier, an undated one, or any under an undated parent is
 * kept as it is. The service clamps with it rather than refusing.
 */
export const clampDue = (due: DueFields, parent: DueFields | null | undefined): DueFields =>
  isDueAfterParent(due, parent) ? { dueOn: parent!.dueOn, dueTime: parent!.dueTime } : due;

/** The field issue when a device edit moves a subtask's due day past its parent's (`isDueAfterParent`). */
export const DUE_AFTER_PARENT_ISSUE = {
  path: "dueOn",
  message: "A subtask can't be due after the todo it's part of",
} as const;

/** What `siblingOrder` reads of a todo. */
export type SiblingFields = {
  id: string;
  dueOn: string | null;
  dueTime: string | null;
  createdAt: string;
};

/**
 * Two siblings' order (a `sort` comparator): dated before undated; dated by
 * day, and on one day timed ones by time before day-only ones; then by when
 * they were made, then the id. In SQL: `SIBLING_ORDER_SQL`. Done or open
 * doesn't move a sibling.
 */
export const compareSiblings = (a: SiblingFields, b: SiblingFields) => {
  if (!a.dueOn !== !b.dueOn) return a.dueOn ? -1 : 1;
  if (a.dueOn && b.dueOn && a.dueOn !== b.dueOn) return a.dueOn < b.dueOn ? -1 : 1;
  if (!a.dueTime !== !b.dueTime) return a.dueTime ? -1 : 1;
  if (a.dueTime && b.dueTime && a.dueTime !== b.dueTime) return a.dueTime < b.dueTime ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

/** `compareSiblings` as an `ORDER BY` list, for the device's tree queries. */
export const SIBLING_ORDER_SQL = "due_on IS NULL, due_on, due_time IS NULL, due_time, created_at, id";

/** A todo's subtasks (or any siblings) in tree order (`compareSiblings`), as a new array. */
export const siblingOrder = <T extends SiblingFields>(siblings: readonly T[]): T[] =>
  [...siblings].sort(compareSiblings);

/**
 * Whether the connectors' `upcoming` lists a subtask (todo-subtasks-3; text
 * for a member's AI, not a screen, so no tree): when it's assigned, or due
 * before its parent's day (`parentDueOn`; under an undated parent any date
 * counts). One on its parent's day is the parent's step and goes with it. A
 * top-level todo always lists.
 */
export const upcomingListsSubtask = (
  todo: {
    parentId?: string | null;
    dueOn: string | null;
    assigneeId: string | null;
    assigneeName: string | null;
  },
  parentDueOn: string | null,
) =>
  !todo.parentId ||
  assigneeOf(todo).type !== "none" ||
  (!!todo.dueOn && (!parentDueOn || todo.dueOn < parentDueOn));

/**
 * The upload's flag on a device's rollup write to a parent (its `_metadata`,
 * as `UNDO_NEXT_METADATA`): the device's tick, reopen, remove or new subtask
 * wrote the parent chain locally, and the server recomputes the parent from
 * its own rows (`todoService.rollUpUploaded`), never as a complete or reopen.
 */
export const ROLLUP_METADATA = "todo:rollup";
