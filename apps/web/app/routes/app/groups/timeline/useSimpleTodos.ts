import type { TodoRow } from "~/lib/todos/todos.sync";

import { todoOrder } from "@caretook/data/schema";
import { useMemo, useSyncExternalStore } from "react";
import { useGroup } from "~/lib/app-shell/group";
import { useNow } from "~/lib/live-notes/editors.sync";
import { useRememberedQuery } from "~/lib/sync/useRememberedQuery";
import { todosQuery, toTodos } from "~/lib/todos/todos.sync";
import { subscribeTodoUndo, type TodoUndo, todoUndoFor, todoUndoSnapshot } from "~/lib/todos/todoUndo";

/** How many todos simple mode's card shows; "See all" opens the rest. */
export const SIMPLE_TODOS_CAP = 5;

const NO_ROWS: TodoRow[] = [];
const NO_OFFERS: readonly TodoUndo[] = [];
const noOffers = () => NO_OFFERS;

/**
 * Simple mode's "My todos": my open todos in list order (`todoOrder`:
 * overdue, then today, then later days, then undated), the first five, and
 * how many there are. `shown` is whether the card is up: when I have open
 * todos, or while Undo is offered for a tick here (so ticking my last one
 * still offers it). Local data, so it works offline. Read through the tile
 * cache: `ready` once my todos are known (remembered from earlier this
 * session or read; a skeleton until then), `fresh` once read live.
 */
export function useSimpleTodos(groupId: string) {
  const group = useGroup();
  const timeZone = group.recipient?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = useNow(60_000);
  const query = todosQuery(groupId, { who: "mine", userId: group.userId });
  const { value, fresh } = useRememberedQuery<TodoRow>({ groupId, name: "simpleTodos:mine" }, query);
  const rows = value ?? NO_ROWS;
  const mine = useMemo(() => todoOrder(toTodos(rows), now, timeZone), [rows, now, timeZone]);
  const offers = useSyncExternalStore(subscribeTodoUndo, todoUndoSnapshot, noOffers);
  const undoing = offers.length > 0 && todoUndoFor(groupId).length > 0;

  return {
    todos: mine.slice(0, SIMPLE_TODOS_CAP),
    total: mine.length,
    shown: mine.length > 0 || undoing,
    ready: value !== undefined,
    fresh,
    now,
    timeZone,
  };
}
