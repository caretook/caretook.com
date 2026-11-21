import type { TimelineEntry } from "~/lib/core/rpc";
import type { LocalTask } from "~/lib/tasks/tasks.sync";
import type { UpcomingTask } from "~/lib/tasks/upcomingTasks";
import type { EntryFilters, EntryRow } from "~/lib/timeline/timeline.sync";

import { useMemo } from "react";
import { upcomingSections } from "~/lib/appointments/upcomingDays";
import { useGroup } from "~/lib/app-shell/group";
import { localTimeZone } from "~/lib/core/format";
import { useNow } from "~/lib/live-notes/editors.sync";
import { useLiveRows } from "~/lib/sync/useLiveRows";
import { useDueTasks } from "~/lib/tasks/tasks.sync";
import { upcomingTasks, withDueTasks } from "~/lib/tasks/upcomingTasks";
import { toTimelineEntries, UPCOMING_HORIZON_DAYS, upcomingQuery } from "~/lib/timeline/timeline.sync";

/** How many items simple mode's Upcoming block lists when opened; "See all" opens the rest. */
export const SIMPLE_UPCOMING_CAP = 5;

/** An appointment or reminder, or an open dated task. */
export type SimpleUpcomingItem = TimelineEntry | UpcomingTask<LocalTask>;

const TICK_MS = 30_000;
const MINUTE_MS = 60_000;
const NO_FILTERS: EntryFilters = { kind: null, author: null };
const NO_ROWS: EntryRow[] = [];

/**
 * Simple mode's opened Upcoming list (B-191): the first five items in
 * Upcoming's order (its window, sections and tasks merged in, unfiltered),
 * without the dose slots, which the block shows above as Given all and
 * which have no page. Mounted only while the list is open; `ready` once
 * the device has answered. Local data, so it works offline.
 */
export function useSimpleUpcoming(groupId: string) {
  const group = useGroup();
  const taskZone = group.recipient?.timeZone || localTimeZone();
  const now = useNow(TICK_MS);
  // Rounded down to the minute, as Upcoming's window is, so the query changes once a minute.
  const query = upcomingQuery(groupId, NO_FILTERS, new Date(Math.floor(now / MINUTE_MS) * MINUTE_MS));
  const entries = useLiveRows<EntryRow>(query.sql, query.params, NO_ROWS);
  const dueTasks = useDueTasks(groupId, taskZone, { days: UPCOMING_HORIZON_DAYS });

  const items = useMemo((): SimpleUpcomingItem[] => {
    const at = new Date(now);
    const viewerZone = localTimeZone();
    const sections = upcomingSections(toTimelineEntries(entries.rows), at, viewerZone);
    const tasks = upcomingTasks(dueTasks.tasks, at, taskZone);
    return withDueTasks(sections, tasks, at, viewerZone, taskZone)
      .flatMap((section) => section.items)
      .slice(0, SIMPLE_UPCOMING_CAP);
  }, [entries.rows, dueTasks.tasks, now, taskZone]);

  return { items, ready: entries.fresh && dueTasks.ready, now: new Date(now), taskZone };
}
