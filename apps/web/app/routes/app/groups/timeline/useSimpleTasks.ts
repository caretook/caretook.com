import type { TaskRow } from "~/lib/tasks/tasks.sync";

import { taskOrder } from "@caretook/data/schema";
import { useMemo, useSyncExternalStore } from "react";
import { useGroup } from "~/lib/app-shell/group";
import { useNow } from "~/lib/live-notes/editors.sync";
import { useRememberedQuery } from "~/lib/sync/useRememberedQuery";
import { tasksQuery, toTasks } from "~/lib/tasks/tasks.sync";
import { subscribeTaskUndo, type TaskUndo, taskUndoFor, taskUndoSnapshot } from "~/lib/tasks/taskUndo";

/** How many tasks simple mode's card shows; "See all" opens the rest. */
export const SIMPLE_TASKS_CAP = 5;

const NO_ROWS: TaskRow[] = [];
const NO_OFFERS: readonly TaskUndo[] = [];
const noOffers = () => NO_OFFERS;

/**
 * Simple mode's "My tasks": my open tasks in list order (`taskOrder`:
 * overdue, then today, then later days, then undated), the first five, and
 * how many there are. `shown` is whether the card is up: when I have open
 * tasks, or while Undo is offered for a tick here (so ticking my last one
 * still offers it). Local data, so it works offline. Read through the tile
 * cache: `ready` once my tasks are known (remembered from earlier this
 * session or read; a skeleton until then), `fresh` once read live.
 */
export function useSimpleTasks(groupId: string) {
  const group = useGroup();
  const timeZone = group.recipient?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = useNow(60_000);
  const query = tasksQuery(groupId, { who: "mine", userId: group.userId });
  const { value, fresh } = useRememberedQuery<TaskRow>({ groupId, name: "simpleTasks:mine" }, query);
  const rows = value ?? NO_ROWS;
  const mine = useMemo(() => taskOrder(toTasks(rows), now, timeZone), [rows, now, timeZone]);
  const offers = useSyncExternalStore(subscribeTaskUndo, taskUndoSnapshot, noOffers);
  const undoing = offers.length > 0 && taskUndoFor(groupId).length > 0;

  return {
    tasks: mine.slice(0, SIMPLE_TASKS_CAP),
    total: mine.length,
    shown: mine.length > 0 || undoing,
    ready: value !== undefined,
    fresh,
    now,
    timeZone,
  };
}
