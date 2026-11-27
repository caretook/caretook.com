import type { QuickAddParent } from "~/components/todos";
import type { LocalTodo, TodoRow } from "~/lib/todos/todos.sync";
import type { loadTodo } from "./loadTodo";

import { subtaskProgress } from "@caretook/data/schema";
import { useMemo } from "react";
import { useLiveQuery } from "~/lib/sync";
import { todoDescendantsQuery, todoQuery, toTodo, toTodos } from "~/lib/todos/todos.sync";

/**
 * The todo's place in its tree, live (todo-subtasks): its parent (for "Part
 * of"), every live todo under it (`descendants`, for the band's tree and the
 * delete's count), its own subtasks with their progress, each one's own
 * progress (`progressOf`, for its row), and its ancestor chain: `ancestors`
 * (for whether it may take another: `TodoQuickAdd`'s rule) and `chain` (the
 * todo and its ancestors, above the tree's top level). Two live queries for
 * the page (the parent, the descendants), never one per subtask.
 */
export function useTodoSubtasks(todo: LocalTodo, initial: Awaited<ReturnType<typeof loadTodo>>) {
  const parentQuery = todoQuery(todo.parentId ?? "");
  const parentRows = useLiveQuery<TodoRow>(parentQuery.sql, parentQuery.params, initial.parentRows);
  const parentRow = todo.parentId && parentRows[0] ? toTodo(parentRows[0]) : null;
  const parent = parentRow && !parentRow.deletedAt ? parentRow : null;

  const query = todoDescendantsQuery(todo.groupId, todo.id);
  const rows = useLiveQuery<TodoRow>(query.sql, query.params, initial.descendantRows);
  const descendants = useMemo(() => toTodos(rows), [rows]);

  // Each todo's live subtasks, from the one query: the band's own, and each one's progress.
  const childrenOf = useMemo(() => {
    const byParent = new Map<string, LocalTodo[]>();
    for (const t of descendants) {
      if (!t.parentId) continue;
      const list = byParent.get(t.parentId);
      if (list) list.push(t);
      else byParent.set(t.parentId, [t]);
    }
    return byParent;
  }, [descendants]);
  const subtasks = useMemo(() => childrenOf.get(todo.id) ?? [], [childrenOf, todo.id]);
  const progressOf = useMemo(
    () => new Map([...childrenOf].map(([id, children]) => [id, subtaskProgress(children)])),
    [childrenOf],
  );

  // Its ancestors as far as depth needs: its parent, and the parent's parent.
  const ancestors = [todo.parentId, parentRow?.parentId].filter(Boolean);
  // The chain above the tree's top level, for depth: the todo, then its parent. (A todo with a
  // grandparent is at `MAX_TODO_DEPTH` and has no tree.) Its parent stands in by id until it loads.
  const chain: QuickAddParent[] = todo.parentId
    ? [todo, parentRow ?? { id: todo.parentId, title: "", deletedAt: null, repeatRule: null }]
    : [todo];
  return {
    parent,
    subtasks,
    descendants,
    progress: subtaskProgress(subtasks),
    progressOf,
    ancestors,
    chain,
  };
}
