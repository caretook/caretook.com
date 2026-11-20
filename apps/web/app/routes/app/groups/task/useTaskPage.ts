import type { MemberRow } from "~/lib/sync/timeline";
import type { TaskRow } from "~/lib/sync/tasks";
import type { loadTask } from "./loadTask";

import { taskState } from "@caretook/data/schema";
import { useCallback, useMemo } from "react";
import { useGroup } from "~/lib/group";
import { scheduleZoneNote } from "~/lib/medicationDisplay";
import { useLiveQuery } from "~/lib/sync";
import { useNow } from "~/lib/sync/editors";
import { taskQuery, toTask } from "~/lib/sync/tasks";
import { membersQuery } from "~/lib/sync/timeline";

/**
 * The task page's data, live: the task (other members' edits, ticks and
 * deletion), its state in the recipient's zone (moving once a minute, so
 * overdue follows the clock), and members' names ("you" for me).
 */
export function useTaskPage(groupId: string, taskId: string, initial: Awaited<ReturnType<typeof loadTask>>) {
  const group = useGroup();
  const timeZone = group.recipient?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = useNow(60_000);

  const query = taskQuery(taskId);
  const rows = useLiveQuery<TaskRow>(query.sql, query.params, initial.taskRows);
  const live = rows[0] ? toTask(rows[0]) : null;
  const deleted = !live || !!live.deletedAt || live.groupId !== groupId;
  const task = live && !deleted ? live : initial.task;

  const memberQuery = membersQuery(groupId);
  const members = useLiveQuery<MemberRow>(memberQuery.sql, memberQuery.params, initial.memberRows);
  const nameOf = useCallback(
    (userId: string) =>
      userId === group.userId ? "you" : (members.find((m) => m.user_id === userId)?.name ?? "Former member"),
    [members, group.userId],
  );

  const zoneNote = useMemo(
    () =>
      scheduleZoneNote(group.recipient?.timeZone ?? null, Intl.DateTimeFormat().resolvedOptions().timeZone),
    [group.recipient?.timeZone],
  );

  return { task, deleted, state: taskState(task, now, timeZone), nameOf, now, timeZone, zoneNote };
}
