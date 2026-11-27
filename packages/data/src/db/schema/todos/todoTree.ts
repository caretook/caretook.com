import { assigneeOf } from "./todoRules";

// Subtasks' pure rules (todo-subtasks, client-safe): a subtask is a todo with
// a `parent_id`. The one place that says how deep the tree goes, which todo
// may take a subtask, how a parent follows its children (the rollup), how
// far along it is, and which subtasks list on their own. The service and
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

/**
 * Whether a todo shows in the lists on its own: a top-level todo, or a
 * subtask with a due day or an assignee. Other subtasks show under their
 * parent only.
 */
export const listsOnItsOwn = (todo: {
  parentId?: string | null;
  dueOn: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
}) => !todo.parentId || !!todo.dueOn || assigneeOf(todo).type !== "none";

/**
 * The upload's flag on a device's rollup write to a parent (its `_metadata`,
 * as `UNDO_NEXT_METADATA`): the device's tick, reopen, remove or new subtask
 * wrote the parent chain locally, and the server recomputes the parent from
 * its own rows (`todoService.rollUpUploaded`), never as a complete or reopen.
 */
export const ROLLUP_METADATA = "todo:rollup";
