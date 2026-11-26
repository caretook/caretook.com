import type { LocalTodo, TodoRow } from "~/lib/todos/todos.sync";
import type { loadTodo } from "./loadTodo";

import { canHaveSubtask, subtaskProgress } from "@caretook/data/schema";
import { useMemo } from "react";
import { useLiveQuery } from "~/lib/sync";
import { subtasksQuery, todoQuery, toTodo, toTodos } from "~/lib/todos/todos.sync";

/**
 * The todo's place in its tree, live (todo-subtasks): its parent (for "Part
 * of"), its live subtasks oldest first with their progress, and whether it
 * may take another (`canHaveSubtask`: not repeating, within the depth limit).
 * Two live queries for the page, never one per subtask.
 */
export function useTodoSubtasks(todo: LocalTodo, initial: Awaited<ReturnType<typeof loadTodo>>) {
  const parentQuery = todoQuery(todo.parentId ?? "");
  const parentRows = useLiveQuery<TodoRow>(parentQuery.sql, parentQuery.params, initial.parentRows);
  const parentRow = todo.parentId && parentRows[0] ? toTodo(parentRows[0]) : null;
  const parent = parentRow && !parentRow.deletedAt ? parentRow : null;

  const childQuery = subtasksQuery(todo.id);
  const childRows = useLiveQuery<TodoRow>(childQuery.sql, childQuery.params, initial.subtaskRows);
  const subtasks = useMemo(() => toTodos(childRows), [childRows]);

  // Its ancestors as far as depth needs: its parent, and the parent's parent.
  const ancestors = [todo.parentId, parentRow?.parentId].filter(Boolean);
  return {
    parent,
    subtasks,
    progress: subtaskProgress(subtasks),
    canAdd: canHaveSubtask(ancestors, todo),
  };
}
