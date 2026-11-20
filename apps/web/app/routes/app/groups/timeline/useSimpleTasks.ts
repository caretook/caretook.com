import type { TaskRow } from "~/lib/tasks/tasks.sync";

import { taskOrder } from "@caretook/data/schema";
import { useMemo, useSyncExternalStore } from "react";
import { useGroup } from "~/lib/app-shell/group";
import { useLiveQuery } from "~/lib/sync";
import { useNow } from "~/lib/live-notes/editors.sync";
import { tasksQuery, toTasks } from "~/lib/tasks/tasks.sync";
import { subscribeTaskUndo, taskUndoFor, taskUndoSnapshot } from "~/lib/tasks/taskUndo";

/** How many tasks simple mode's card shows; "See all" opens the rest. */
export const SIMPLE_TASKS_CAP = 5;

const NO_ROWS: TaskRow[] = [];
const noOffer = () => null;

/**
 * Simple mode's "My tasks": my open tasks in list order (`taskOrder`:
 * overdue, then today, then later days, then undated), the first five, and
 * how many there are. `shown` is whether the card is up: when I have open
 * tasks, or while Undo is offered for a tick here (so ticking my last one
 * still offers it). Local data, so it works offline.
 */
export function useSimpleTasks(groupId: string) {
  const group = useGroup();
  const timeZone = group.recipient?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = useNow(60_000);
  const query = tasksQuery(groupId, { who: "mine", userId: group.userId });
  const rows = useLiveQuery<TaskRow>(query.sql, query.params, NO_ROWS);
  const mine = useMemo(() => taskOrder(toTasks(rows), now, timeZone), [rows, now, timeZone]);
  const offer = useSyncExternalStore(subscribeTaskUndo, taskUndoSnapshot, noOffer);
  const undoing = !!offer && !!taskUndoFor(groupId);

  return {
    tasks: mine.slice(0, SIMPLE_TASKS_CAP),
    total: mine.length,
    shown: mine.length > 0 || undoing,
    now,
    timeZone,
  };
}
