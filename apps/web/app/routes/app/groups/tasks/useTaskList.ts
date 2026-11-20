import type { TaskWho } from "~/lib/tasks/taskList";
import type { TaskRow } from "~/lib/tasks/tasks.sync";
import type { MemberRow } from "~/lib/timeline/timeline.sync";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { useGroup } from "~/lib/app-shell/group";
import { useLiveQuery } from "~/lib/sync";
import { doneCountQuery, tasksQuery, toTasks } from "~/lib/tasks/tasks.sync";
import { membersQuery } from "~/lib/timeline/timeline.sync";
import { defaultWho, parseWho, showsTask, taskSections } from "~/lib/tasks/taskList";

/** How many done tasks a page of the Done list shows. */
export const DONE_PAGE = 20;

const MINUTE = 60_000;

/** Now, moving once a minute, so overdue and today follow the clock. */
function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export type TaskListRows = { openRows: TaskRow[]; doneRows: TaskRow[]; memberRows: MemberRow[] };
const NO_COUNT: { count: number }[] = [];

/**
 * The task list's data, live: the open tasks the chip shows, in sections
 * (in the recipient's zone), the Done page, and members' names. The chip
 * comes from `?who=`; with none it's Mine when I had open tasks as the list
 * opened, else Everyone (decided once, so ticking my last one doesn't flip it).
 */
export function useTaskList(groupId: string, initial: TaskListRows) {
  const group = useGroup();
  const { search } = useLocation();
  const timeZone = group.recipient?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = useMinuteClock();

  const openQuery = tasksQuery(groupId);
  const openRows = useLiveQuery<TaskRow>(openQuery.sql, openQuery.params, initial.openRows);
  const open = useMemo(() => toTasks(openRows), [openRows]);

  const [fallbackWho] = useState<TaskWho>(() => defaultWho(toTasks(initial.openRows), group.userId));
  const who = parseWho(search) ?? fallbackWho;

  const [doneLimit, setDoneLimit] = useState(DONE_PAGE);
  const doneQuery = tasksQuery(groupId, { done: true, who, userId: group.userId, limit: doneLimit });
  const doneRows = useLiveQuery<TaskRow>(doneQuery.sql, doneQuery.params, initial.doneRows);
  const done = useMemo(() => toTasks(doneRows), [doneRows]);
  const countQuery = doneCountQuery(groupId, { who, userId: group.userId });
  const [count] = useLiveQuery<{ count: number }>(countQuery.sql, countQuery.params, NO_COUNT);
  const moreDone = (count?.count ?? 0) > done.length;
  const showMoreDone = useCallback(() => setDoneLimit((n) => n + DONE_PAGE), []);

  const memberQuery = membersQuery(groupId);
  const members = useLiveQuery<MemberRow>(memberQuery.sql, memberQuery.params, initial.memberRows);
  const nameOf = useCallback(
    (userId: string) =>
      userId === group.userId ? "you" : (members.find((m) => m.user_id === userId)?.name ?? "Former member"),
    [members, group.userId],
  );

  const sections = useMemo(
    () =>
      taskSections(
        open.filter((t) => showsTask(who, t, group.userId)),
        now,
        timeZone,
      ),
    [open, who, group.userId, now, timeZone],
  );

  return { who, sections, done, moreDone, showMoreDone, nameOf, now, timeZone, total: open.length };
}
