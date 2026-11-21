import type { TodoWho } from "~/lib/todos/todoList";
import type { TodoRow } from "~/lib/todos/todos.sync";
import type { MemberRow } from "~/lib/timeline/timeline.sync";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { useGroup } from "~/lib/app-shell/group";
import { useLiveQuery } from "~/lib/sync";
import { doneCountQuery, todosQuery, toTodos } from "~/lib/todos/todos.sync";
import { membersQuery } from "~/lib/timeline/timeline.sync";
import { defaultWho, parseWho, showsTodo, todoSections } from "~/lib/todos/todoList";

/** How many done todos a page of the Done list shows. */
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

export type TodoListRows = { openRows: TodoRow[]; doneRows: TodoRow[]; memberRows: MemberRow[] };
const NO_COUNT: { count: number }[] = [];

/**
 * The todo list's data, live: the open todos the chip shows, in sections
 * (in the recipient's zone), the Done page, and members' names. The chip
 * comes from `?who=`; with none it's Mine when I had open todos as the list
 * opened, else Everyone (decided once, so ticking my last one doesn't flip it).
 */
export function useTodoList(groupId: string, initial: TodoListRows) {
  const group = useGroup();
  const { search } = useLocation();
  const timeZone = group.recipient?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = useMinuteClock();

  const openQuery = todosQuery(groupId);
  const openRows = useLiveQuery<TodoRow>(openQuery.sql, openQuery.params, initial.openRows);
  const open = useMemo(() => toTodos(openRows), [openRows]);

  const [fallbackWho] = useState<TodoWho>(() => defaultWho(toTodos(initial.openRows), group.userId));
  const who = parseWho(search) ?? fallbackWho;

  const [doneLimit, setDoneLimit] = useState(DONE_PAGE);
  const doneQuery = todosQuery(groupId, { done: true, who, userId: group.userId, limit: doneLimit });
  const doneRows = useLiveQuery<TodoRow>(doneQuery.sql, doneQuery.params, initial.doneRows);
  const done = useMemo(() => toTodos(doneRows), [doneRows]);
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
      todoSections(
        open.filter((t) => showsTodo(who, t, group.userId)),
        now,
        timeZone,
      ),
    [open, who, group.userId, now, timeZone],
  );

  return { who, sections, done, moreDone, showMoreDone, nameOf, now, timeZone, total: open.length };
}
