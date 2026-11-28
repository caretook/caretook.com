import type { TodoLink, TodoRow } from "~/lib/todos/todos.sync";
import type { MemberRow } from "~/lib/timeline/timeline.sync";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useGroup } from "~/lib/app-shell/group";
import { useLiveQuery } from "~/lib/sync";
import { useLiveRows } from "~/lib/sync/useLiveRows";
import { useNow } from "~/lib/live-notes/editors.sync";
import { linkedTodosQuery, toTodos } from "~/lib/todos/todos.sync";
import { membersQuery } from "~/lib/timeline/timeline.sync";
import { subscribeTodoUndo, type TodoUndo, todoUndoFor, todoUndoSnapshot } from "~/lib/todos/todoUndo";
import { todoOrder } from "@caretook/data/domain";

const NO_TODOS: TodoRow[] = [];
const NO_MEMBERS: MemberRow[] = [];
const NO_OFFERS: readonly TodoUndo[] = [];
const noOffers = () => NO_OFFERS;

/**
 * The open todos linked to one provider, medication or event, in list order
 * (`todoOrder`: overdue, today, later days, undated), live and re-evaluated
 * once a minute; members' names for the assignee ("you" for me). `shown`
 * is whether the list is up: while there are open todos, or while Undo is
 * offered for a tick made here (`ticked`; so ticking the last one still
 * offers it). The todos wait for the members' first answer, so an assignee
 * is never "Former member" just because the names haven't loaded.
 */
export function useLinkedTodos(link: TodoLink) {
  const group = useGroup();
  const timeZone = group.recipient?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = useNow(60_000);
  const query = linkedTodosQuery(group.id, link);
  const rows = useLiveQuery<TodoRow>(query.sql, query.params, NO_TODOS);
  const mq = membersQuery(group.id);
  const { rows: members, fresh: membersAnswered } = useLiveRows<MemberRow>(mq.sql, mq.params, NO_MEMBERS);
  const todos = useMemo(
    () => (membersAnswered ? todoOrder(toTodos(rows), now, timeZone) : []),
    [membersAnswered, rows, now, timeZone],
  );
  const nameOf = useCallback(
    (userId: string) =>
      userId === group.userId ? "you" : (members.find((m) => m.user_id === userId)?.name ?? "Former member"),
    [members, group.userId],
  );

  // The todos ticked here: only their Undo keeps the region up.
  const [tickedHere, setTickedHere] = useState<ReadonlySet<string>>(() => new Set());
  const ticked = useCallback((todoId: string) => setTickedHere((ids) => new Set(ids).add(todoId)), []);
  const offers = useSyncExternalStore(subscribeTodoUndo, todoUndoSnapshot, noOffers);
  const undoing = offers.length > 0 && todoUndoFor(group.id).some((o) => tickedHere.has(o.todoId));
  return { todos, nameOf, now, timeZone, ticked, shown: todos.length > 0 || undoing };
}
