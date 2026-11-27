import type { TimelineEntry } from "~/lib/core/rpc";
import type { LocalTodo } from "~/lib/todos/todos.sync";
import type { PlannerTree } from "~/lib/todos/plannerTodos";
import type { EntryRow } from "~/lib/timeline/timeline.sync";
import type { TodoRow } from "~/lib/todos/todos.sync";

import { useMemo } from "react";
import { useGroup } from "~/lib/app-shell/group";
import { localTimeZone } from "~/lib/core/format";
import { useNow } from "~/lib/live-notes/editors.sync";
import { useLiveRows } from "~/lib/sync/useLiveRows";
import { dueTodosThrough, todoTreesQuery, toTodos } from "~/lib/todos/todos.sync";
import { toTimelineEntries, UPCOMING_HORIZON_DAYS } from "~/lib/timeline/timeline.sync";
import { easyUpcomingItems, easyUpcomingQuery } from "./easyUpcoming";

/** An appointment, or a todo's tree on a day (a parent's, or a step's branch). */
export type EasyUpcomingItem = TimelineEntry | PlannerTree<LocalTodo>;

const TICK_MS = 30_000;
const NO_ROWS: EntryRow[] = [];
const NO_TODOS: TodoRow[] = [];

/**
 * Easy mode's opened Upcoming list (B-191): the first five items in
 * Upcoming's order (its window, sections and todos merged in, unfiltered),
 * without the dose slots, which the block shows above as Given all and
 * which have no page; todos as the Planner's day trees, from the trees'
 * one query (todo-subtasks-3). Mounted only while the list is open; `ready` once
 * the device has answered. Local data, so it works offline.
 */
export function useEasyUpcoming(groupId: string) {
  const group = useGroup();
  const todoZone = group.recipient?.timeZone || localTimeZone();
  const now = useNow(TICK_MS);
  // Built from the day, so a tick reruns no query; the tick only splits the rows (B-963).
  const query = easyUpcomingQuery(groupId, now);
  const entries = useLiveRows<EntryRow>(query.sql, query.params, NO_ROWS);
  const treesSql = todoTreesQuery(groupId);
  const treeRows = useLiveRows<TodoRow>(treesSql.sql, treesSql.params, NO_TODOS);
  const todos = useMemo(() => toTodos(treeRows.rows), [treeRows.rows]);

  const items = useMemo(
    (): EasyUpcomingItem[] =>
      easyUpcomingItems(
        toTimelineEntries(entries.rows),
        todos,
        new Date(now),
        localTimeZone(),
        todoZone,
        dueTodosThrough(now, todoZone, UPCOMING_HORIZON_DAYS),
      ),
    [entries.rows, todos, now, todoZone],
  );

  return { items, ready: entries.fresh && treeRows.fresh, now: new Date(now), todoZone };
}
