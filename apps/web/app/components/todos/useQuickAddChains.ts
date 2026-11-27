import type { LocalTodo } from "~/lib/todos/todos.sync";

import { useCallback, useMemo } from "react";
import { useLiveQuery } from "~/lib/sync";
import { todoParentLinksQuery } from "~/lib/todos/todos.sync";

type ParentLinkRow = { id: string; parent_id: string | null };
const NO_ROWS: ParentLinkRow[] = [];

/**
 * Each listed todo's ancestor chain as far as depth needs (its parent, and
 * the parent's parent), for its compact `TodoQuickAdd` on a flat list (a
 * provider's, medication's or entry's Todos). One live query for the list.
 */
export function useQuickAddChains(todos: readonly Pick<LocalTodo, "parentId">[]) {
  const parentIds = useMemo(
    () => [...new Set(todos.flatMap((t) => (t.parentId ? [t.parentId] : [])))].sort(),
    [todos],
  );
  const query = todoParentLinksQuery(parentIds);
  const rows = useLiveQuery<ParentLinkRow>(query.sql, query.params, NO_ROWS);
  const above = useMemo(() => new Map(rows.map((r) => [r.id, r.parent_id])), [rows]);
  return useCallback(
    (todo: Pick<LocalTodo, "parentId">): string[] =>
      todo.parentId ? [todo.parentId, above.get(todo.parentId)].filter((id): id is string => !!id) : [],
    [above],
  );
}
