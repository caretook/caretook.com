import type { TimelineEntry } from "~/lib/core/rpc";
import type { LocalTodo } from "~/lib/todos/todos.sync";
import type { UpcomingTodo } from "~/lib/todos/plannerTodos";
import type { EntryFilters, EntryRow } from "~/lib/timeline/timeline.sync";

import { useMemo } from "react";
import { upcomingSections } from "~/lib/appointments/upcomingDays";
import { useGroup } from "~/lib/app-shell/group";
import { localTimeZone } from "~/lib/core/format";
import { useNow } from "~/lib/live-notes/editors.sync";
import { useLiveRows } from "~/lib/sync/useLiveRows";
import { useDueTodos } from "~/lib/todos/todos.sync";
import { plannerTodos, withDueTodos } from "~/lib/todos/plannerTodos";
import { toTimelineEntries, UPCOMING_HORIZON_DAYS, upcomingQuery } from "~/lib/timeline/timeline.sync";

/** How many items simple mode's Upcoming block lists when opened; "See all" opens the rest. */
export const SIMPLE_UPCOMING_CAP = 5;

/** An appointment or reminder, or an open dated todo. */
export type SimpleUpcomingItem = TimelineEntry | UpcomingTodo<LocalTodo>;

const TICK_MS = 30_000;
const MINUTE_MS = 60_000;
const NO_FILTERS: EntryFilters = { kind: null, author: null };
const NO_ROWS: EntryRow[] = [];

/**
 * Simple mode's opened Upcoming list (B-191): the first five items in
 * Upcoming's order (its window, sections and todos merged in, unfiltered),
 * without the dose slots, which the block shows above as Given all and
 * which have no page. Mounted only while the list is open; `ready` once
 * the device has answered. Local data, so it works offline.
 */
export function useSimpleUpcoming(groupId: string) {
  const group = useGroup();
  const todoZone = group.recipient?.timeZone || localTimeZone();
  const now = useNow(TICK_MS);
  // Rounded down to the minute, as Upcoming's window is, so the query changes once a minute.
  const query = upcomingQuery(groupId, NO_FILTERS, new Date(Math.floor(now / MINUTE_MS) * MINUTE_MS));
  const entries = useLiveRows<EntryRow>(query.sql, query.params, NO_ROWS);
  const dueTodos = useDueTodos(groupId, todoZone, { days: UPCOMING_HORIZON_DAYS });

  const items = useMemo((): SimpleUpcomingItem[] => {
    const at = new Date(now);
    const viewerZone = localTimeZone();
    const sections = upcomingSections(toTimelineEntries(entries.rows), at, viewerZone);
    const todos = plannerTodos(dueTodos.todos, at, todoZone);
    return withDueTodos(sections, todos, at, viewerZone, todoZone)
      .flatMap((section) => section.items)
      .slice(0, SIMPLE_UPCOMING_CAP);
  }, [entries.rows, dueTodos.todos, now, todoZone]);

  return { items, ready: entries.fresh && dueTodos.ready, now: new Date(now), todoZone };
}
