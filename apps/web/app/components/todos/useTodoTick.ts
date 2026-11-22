import { useCallback, useState } from "react";
import { completedText } from "~/lib/todos/todoDisplay";
import { clearTodoUndo, offerTodoUndo } from "~/lib/todos/todoUndo";
import { getSync } from "~/lib/sync";
import { completeTodo, reopenTodo } from "~/lib/todos/todos.sync";

/**
 * Ticking todos done and reopening them: the one path for every todo tick
 * (the list, the page, Upcoming, the easy card, `LinkedTodos`). Local
 * writes, so they work offline; each tick offers its own Undo for about
 * 10 s (`TodoUndoStatus` shows them). Each control has its own, so `busy` and
 * `error` are its own.
 */
export function useTodoTick(groupId: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (write: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await write();
      if (!result.ok) setError(result.error);
      return result.ok;
    } finally {
      setBusy(false);
    }
  }, []);

  const complete = useCallback(
    (todo: { id: string; title: string }) =>
      run(async () => {
        const result = await completeTodo(getSync(), todo.id);
        if (result.ok)
          offerTodoUndo({ groupId, todoId: todo.id, title: todo.title, label: completedText(todo.title) });
        return result;
      }),
    [groupId, run],
  );

  const reopen = useCallback(
    (todo: { id: string }) =>
      run(async () => {
        const result = await reopenTodo(getSync(), todo.id);
        return result;
      }),
    [run],
  );

  return { complete, reopen, busy, error };
}

/** Undo one tick: reopens just that todo, and drops only its offer. */
export async function undoTodoTick(key: string, todoId: string) {
  const result = await reopenTodo(getSync(), todoId);
  if (result.ok) clearTodoUndo(key);
  return result;
}
