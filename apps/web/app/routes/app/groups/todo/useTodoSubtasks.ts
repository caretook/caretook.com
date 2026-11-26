import type { SubtaskProgressRow, LocalTodo, TodoRow } from "~/lib/todos/todos.sync";
import type { loadTodo } from "./loadTodo";

import { canHaveSubtask, subtaskProgress } from "@caretook/data/schema";
import { useMemo } from "react";
import { useLiveQuery } from "~/lib/sync";
import {
  progressByParent,
  subtaskProgressQuery,
  subtasksQuery,
  todoQuery,
  toTodo,
  toTodos,
} from "~/lib/todos/todos.sync";

/**
 * The todo's place in its tree, live (todo-subtasks): its parent (for "Part
 * of"), its live subtasks oldest first with their progress, each subtask's
 * own progress (`progressOf`, for its tick), how many todos a delete takes
 * with it (`descendants`), and whether it may take another
 * (`canHaveSubtask`: not repeating, within the depth limit). Three live
 * queries for the page (the progress is the group's one), never one per
 * subtask.
 */
export function useTodoSubtasks(todo: LocalTodo, initial: Awaited<ReturnType<typeof loadTodo>>) {
  const parentQuery = todoQuery(todo.parentId ?? "");
  const parentRows = useLiveQuery<TodoRow>(parentQuery.sql, parentQuery.params, initial.parentRows);
  const parentRow = todo.parentId && parentRows[0] ? toTodo(parentRows[0]) : null;
  const parent = parentRow && !parentRow.deletedAt ? parentRow : null;

  const childQuery = subtasksQuery(todo.id);
  const childRows = useLiveQuery<TodoRow>(childQuery.sql, childQuery.params, initial.subtaskRows);
  const subtasks = useMemo(() => toTodos(childRows), [childRows]);

  const progressQuery = subtaskProgressQuery(todo.groupId);
  const progressRows = useLiveQuery<SubtaskProgressRow>(
    progressQuery.sql,
    progressQuery.params,
    initial.progressRows,
  );
  const progressOf = useMemo(() => progressByParent(progressRows), [progressRows]);

  // Its ancestors as far as depth needs: its parent, and the parent's parent.
  const ancestors = [todo.parentId, parentRow?.parentId].filter(Boolean);
  // The live descendants a delete takes: its subtasks and theirs (three levels at most, `MAX_TODO_DEPTH`).
  const descendants = subtasks.reduce((n, sub) => n + 1 + (progressOf.get(sub.id)?.total ?? 0), 0);
  return {
    parent,
    subtasks,
    progress: subtaskProgress(subtasks),
    progressOf,
    descendants,
    canAdd: canHaveSubtask(ancestors, todo),
  };
}
