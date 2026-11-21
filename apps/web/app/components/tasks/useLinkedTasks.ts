import type { TaskLink, TaskRow } from "~/lib/tasks/tasks.sync";
import type { MemberRow } from "~/lib/timeline/timeline.sync";

import { todoOrder } from "@caretook/data/schema";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useGroup } from "~/lib/app-shell/group";
import { useLiveQuery } from "~/lib/sync";
import { useNow } from "~/lib/live-notes/editors.sync";
import { linkedTasksQuery, toTasks } from "~/lib/tasks/tasks.sync";
import { membersQuery } from "~/lib/timeline/timeline.sync";
import { subscribeTaskUndo, type TaskUndo, taskUndoFor, taskUndoSnapshot } from "~/lib/tasks/taskUndo";

const NO_TASKS: TaskRow[] = [];
const NO_MEMBERS: MemberRow[] = [];
const NO_OFFERS: readonly TaskUndo[] = [];
const noOffers = () => NO_OFFERS;

/**
 * The open tasks linked to one provider, medication or event, in list order
 * (`todoOrder`: overdue, today, later days, undated), live and re-evaluated
 * once a minute; members' names for the assignee ("you" for me). `shown`
 * is whether the list is up: while there are open tasks, or while Undo is
 * offered for a tick made here (`ticked`; so ticking the last one still
 * offers it).
 */
export function useLinkedTasks(link: TaskLink) {
  const group = useGroup();
  const timeZone = group.recipient?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = useNow(60_000);
  const query = linkedTasksQuery(group.id, link);
  const rows = useLiveQuery<TaskRow>(query.sql, query.params, NO_TASKS);
  const tasks = useMemo(() => todoOrder(toTasks(rows), now, timeZone), [rows, now, timeZone]);

  const mq = membersQuery(group.id);
  const members = useLiveQuery<MemberRow>(mq.sql, mq.params, NO_MEMBERS);
  const nameOf = useCallback(
    (userId: string) =>
      userId === group.userId ? "you" : (members.find((m) => m.user_id === userId)?.name ?? "Former member"),
    [members, group.userId],
  );

  // The tasks ticked here: only their Undo keeps the region up.
  const [tickedHere, setTickedHere] = useState<ReadonlySet<string>>(() => new Set());
  const ticked = useCallback((taskId: string) => setTickedHere((ids) => new Set(ids).add(taskId)), []);
  const offers = useSyncExternalStore(subscribeTaskUndo, taskUndoSnapshot, noOffers);
  const undoing = offers.length > 0 && taskUndoFor(group.id).some((o) => tickedHere.has(o.taskId));
  return { tasks, nameOf, now, timeZone, ticked, shown: tasks.length > 0 || undoing };
}
