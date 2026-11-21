import type { MemberRow } from "~/lib/timeline/timeline.sync";
import type { TodoRow } from "~/lib/todos/todos.sync";
import type { loadTodo } from "./loadTodo";

import { todoState } from "@caretook/data/schema";
import { useCallback, useMemo } from "react";
import { useGroup } from "~/lib/app-shell/group";
import { scheduleZoneNote } from "~/lib/medications/medicationDisplay";
import { useLiveQuery } from "~/lib/sync";
import { useNow } from "~/lib/live-notes/editors.sync";
import { todoQuery, toTodo } from "~/lib/todos/todos.sync";
import { membersQuery } from "~/lib/timeline/timeline.sync";

/**
 * The todo page's data, live: the todo (other members' edits, ticks and
 * deletion), its state in the recipient's zone (moving once a minute, so
 * overdue follows the clock), and members' names ("you" for me).
 */
export function useTodoPage(groupId: string, todoId: string, initial: Awaited<ReturnType<typeof loadTodo>>) {
  const group = useGroup();
  const timeZone = group.recipient?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = useNow(60_000);

  const query = todoQuery(todoId);
  const rows = useLiveQuery<TodoRow>(query.sql, query.params, initial.todoRows);
  const live = rows[0] ? toTodo(rows[0]) : null;
  const deleted = !live || !!live.deletedAt || live.groupId !== groupId;
  const todo = live && !deleted ? live : initial.todo;

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

  return { todo, deleted, state: todoState(todo, now, timeZone), nameOf, now, timeZone, zoneNote };
}
