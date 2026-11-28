import type { OpenTodoCountRow } from "~/lib/todos/entryTodos.sync";

import { useMemo } from "react";
import { useLiveQuery } from "~/lib/sync";
import { openCountsByEntry, openTodoCountsQuery } from "~/lib/todos/entryTodos.sync";

const NO_ROWS: OpenTodoCountRow[] = [];

/**
 * How many open todos each note and event links (planner-3), live: one
 * query for the whole group, never one per row. Off (`on` false: easy mode),
 * it reads nothing and every count is undefined.
 */
export function useOpenTodoCounts(groupId: string, on = true) {
  // Off: a group id that matches nothing, so the hook's query stays one.
  const q = openTodoCountsQuery(on ? groupId : "");
  const rows = useLiveQuery<OpenTodoCountRow>(q.sql, q.params, NO_ROWS);
  return useMemo(() => openCountsByEntry(rows), [rows]);
}
