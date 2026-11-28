import type { MenuEntry } from "~/components/ui";
import type { LocalTodo } from "~/lib/todos/todos.sync";

import { Ellipsis, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ConfirmDialog, Menu, Message } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { getSync } from "~/lib/sync";
import { readRows } from "~/lib/timeline/timeline.sync";
import { removeTodo, skipTodo, todoDescendantsQuery } from "~/lib/todos/todos.sync";
import { listSearch, TODO_SHEET_STATE } from "~/lib/todos/todoSheets";
import { RepeatDeleteDialog } from "./RepeatDeleteDialog";
import { useTodoTick } from "./useTodoTick";

const WRITE_FAILED = "Couldn't save that. Try again.";

/** The delete confirm's words: the todo, its subtasks (when it has any) and its notes. */
export const deleteMessage = (title: string, subtasks: number) =>
  subtasks > 0
    ? `“${title}”, its ${subtasks === 1 ? "subtask" : `${subtasks} subtasks`} and their notes will be removed for everyone in the care group.`
    : `“${title}” and its notes will be removed for everyone in the care group.`;

/**
 * A writer's ⋯ on a todo (B-1022): the one menu on its rows (`TodoRow`) and
 * its page's header. Edit opens the edit sheet, which closes back to where
 * it was opened (the list under it keeps its chip and scroll); Reopen, once
 * it's done; Delete, behind a confirm naming how many subtasks go with it
 * (every level: the page passes `subtasks`, a row's are read when asked)
 * or, for an open repeating todo, the choice of skipping this one or
 * stopping the repeat (`RepeatDeleteDialog`). The delete and skip are local
 * writes (`removeTodo`, `skipTodo`): a row leaves its list by its live
 * query; `onDelete` hears one as it's sent (the page then goes back to its
 * list). Readers get nothing.
 */
export function TodoMenu({
  todo,
  subtasks,
  onDelete,
  className = "",
}: {
  todo: Pick<LocalTodo, "id" | "groupId" | "title" | "doneAt" | "repeatRule">;
  /** Its live descendants, when the caller has them (the page); otherwise read on Delete. */
  subtasks?: number;
  onDelete?: () => void;
  /** Outer classes for the trigger (a margin). */
  className?: string;
}) {
  const group = useGroup();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const tick = useTodoTick(todo.groupId);
  // The subtask count once Delete asked (the confirm waits for it), else null.
  const [confirming, setConfirming] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!group.canWrite) return null;

  const done = !!todo.doneAt;
  const asksRepeat = !!todo.repeatRule && !done;
  // Over the Todos list, the list under the sheet keeps its chip.
  const onList = pathname === appUrls.todos(todo.groupId);
  const edit = () =>
    void navigate(appUrls.editTodo(todo.groupId, todo.id, onList ? listSearch(search) : undefined), {
      // Closing the sheet goes back here; the list under it stays where it was scrolled.
      state: TODO_SHEET_STATE,
      preventScrollReset: true,
    });
  const askDelete = () => {
    setError(null);
    if (subtasks !== undefined || asksRepeat) return setConfirming(subtasks ?? 0);
    readRows(getSync(), todoDescendantsQuery(todo.groupId, todo.id))
      .then((rows) => setConfirming(rows.length))
      .catch((e: unknown) => {
        console.error("Couldn't count the subtasks", e);
        setConfirming(0);
      });
  };
  const send = (skip: boolean) => {
    setConfirming(null);
    onDelete?.();
    const db = getSync();
    (skip ? skipTodo(db, todo.id) : removeTodo(db, todo.id))
      .then((result) => !result.ok && setError(result.error))
      .catch((e: unknown) => {
        console.error("Couldn't delete the todo", e);
        setError(WRITE_FAILED);
      });
  };
  const items: MenuEntry[] = [
    { id: "edit", label: "Edit", icon: Pencil, onAction: edit },
    done && {
      id: "reopen",
      label: "Reopen",
      icon: RotateCcw,
      isDisabled: tick.busy,
      onAction: () => void tick.reopen(todo),
    },
    { id: "delete", label: "Delete", icon: Trash2, tone: "danger", onAction: askDelete },
  ];
  const message = error ?? tick.error;

  return (
    <>
      <Menu
        label={`Actions for ${todo.title}`}
        items={items}
        variant="ghost"
        size="sm"
        shape="square"
        className={`shrink-0 ${className}`}
        data-todo-menu={todo.id}
      >
        <Ellipsis className="size-4" aria-hidden="true" />
      </Menu>
      {message && <Message tone="error">{message}</Message>}
      {asksRepeat ? (
        <RepeatDeleteDialog
          open={confirming !== null}
          title={todo.title}
          onClose={() => setConfirming(null)}
          onSkip={() => send(true)}
          onStop={() => send(false)}
        />
      ) : (
        <ConfirmDialog
          open={confirming !== null}
          title="Delete this todo?"
          message={deleteMessage(todo.title, confirming ?? 0)}
          confirmLabel="Delete"
          onClose={() => setConfirming(null)}
          onConfirm={() => send(false)}
        />
      )}
    </>
  );
}
