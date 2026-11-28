import type { SubtaskProgressRow, TodoRow } from "~/lib/todos/todos.sync";

import { useMemo, useSyncExternalStore } from "react";
import { useGroup } from "~/lib/app-shell/group";
import { useNow } from "~/lib/live-notes/editors.sync";
import { useRememberedQuery } from "~/lib/sync/useRememberedQuery";
import { progressByParent, subtaskProgressQuery, todoTreesQuery, toTodos } from "~/lib/todos/todos.sync";
import { subscribeTodoUndo, type TodoUndo, todoUndoFor, todoUndoSnapshot } from "~/lib/todos/todoUndo";
import { EASY_TODOS_CAP, easyTodoTrees } from "./easyTodoTrees";

const NO_ROWS: TodoRow[] = [];
const NO_PROGRESS: SubtaskProgressRow[] = [];
const NO_OFFERS: readonly TodoUndo[] = [];
const noOffers = () => NO_OFFERS;

/**
 * Easy mode's "My todos" (todo-subtasks-3): my open todos as trees
 * (`easyTodoTrees` over the trees' one query, `todoTreesQuery`), in list
 * order, each step of mine under its ancestors as context rows; the first
 * trees holding five of mine (every one for the easy roles, who have no
 * Todos list), and how many of mine there are. `shown` is whether the card
 * is up: when I have open todos, or while Undo is offered for a tick here
 * (so ticking my last one still offers it). Local data, so it works
 * offline. Read through the tile cache: `ready` once my todos are known
 * (remembered from earlier this session or read; a skeleton until then),
 * `fresh` once read live. The group's one progress query gives a parent's
 * progress (its tick waits on open subtasks).
 */
export function useEasyTodos(groupId: string) {
  const group = useGroup();
  const timeZone = group.recipient?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = useNow(60_000);
  const { value, fresh } = useRememberedQuery<TodoRow>(
    { groupId, name: "easyTodos:trees" },
    todoTreesQuery(groupId),
  );
  const tree = useRememberedQuery<SubtaskProgressRow>(
    { groupId, name: "easyTodos:progress" },
    subtaskProgressQuery(groupId),
  );
  const treeRows = tree.value ?? NO_PROGRESS;
  const progress = useMemo(() => progressByParent(treeRows), [treeRows]);
  const rows = value ?? NO_ROWS;
  const cap = group.easyRole ? undefined : EASY_TODOS_CAP;
  const { trees, total, shown } = useMemo(
    () => easyTodoTrees(toTodos(rows), { userId: group.userId, now, timeZone, cap }),
    [rows, group.userId, now, timeZone, cap],
  );
  const offers = useSyncExternalStore(subscribeTodoUndo, todoUndoSnapshot, noOffers);
  const undoing = offers.length > 0 && todoUndoFor(groupId).length > 0;

  return {
    trees,
    /** How many of mine the trees show. */
    count: shown,
    total,
    shown: total > 0 || undoing,
    ready: value !== undefined,
    fresh,
    progressOf: (todoId: string) => progress.get(todoId),
    now,
    timeZone,
  };
}
