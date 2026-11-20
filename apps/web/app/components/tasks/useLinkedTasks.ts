import type { TaskLink, TaskRow } from "~/lib/sync/tasks";
import type { MemberRow } from "~/lib/sync/timeline";

import { taskOrder } from "@caretook/data/schema";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useGroup } from "~/lib/group";
import { useLiveQuery } from "~/lib/sync";
import { useNow } from "~/lib/sync/editors";
import { linkedTasksQuery, toTasks } from "~/lib/sync/tasks";
import { membersQuery } from "~/lib/sync/timeline";
import { subscribeTaskUndo, taskUndoFor, taskUndoSnapshot } from "~/lib/taskUndo";

const NO_TASKS: TaskRow[] = [];
const NO_MEMBERS: MemberRow[] = [];
const noOffer = () => null;

/**
 * The open tasks linked to one provider, medication or event, in list order
 * (`taskOrder`: overdue, today, later days, undated), live and re-evaluated
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
  const tasks = useMemo(() => taskOrder(toTasks(rows), now, timeZone), [rows, now, timeZone]);

  const mq = membersQuery(group.id);
  const members = useLiveQuery<MemberRow>(mq.sql, mq.params, NO_MEMBERS);
  const nameOf = useCallback(
    (userId: string) =>
      userId === group.userId ? "you" : (members.find((m) => m.user_id === userId)?.name ?? "Former member"),
    [members, group.userId],
  );

  // The last task ticked here: only its Undo keeps the region up.
  const [tickedHere, ticked] = useState<string | null>(null);
  const offer = useSyncExternalStore(subscribeTaskUndo, taskUndoSnapshot, noOffer);
  const undo = offer ? taskUndoFor(group.id) : null;
  const undoing = !!undo && undo.taskId === tickedHere;
  return { tasks, nameOf, now, timeZone, ticked, shown: tasks.length > 0 || undoing };
}
