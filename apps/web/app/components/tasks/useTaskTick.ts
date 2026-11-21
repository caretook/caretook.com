import { useCallback, useState } from "react";
import { completedText } from "~/lib/tasks/taskDisplay";
import { clearTaskUndo, offerTaskUndo } from "~/lib/tasks/taskUndo";
import { getSync } from "~/lib/sync";
import { completeTask, reopenTask } from "~/lib/tasks/tasks.sync";

/**
 * Ticking tasks done and reopening them: the one path for every task tick
 * (the list, the page, Upcoming, the simple card, `LinkedTasks`). Local
 * writes, so they work offline; each tick offers its own Undo for about
 * 10 s (`TaskUndoStatus` shows them). Each control has its own, so `busy` and
 * `error` are its own.
 */
export function useTaskTick(groupId: string) {
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
    (task: { id: string; title: string }) =>
      run(async () => {
        const result = await completeTask(getSync(), task.id);
        if (result.ok)
          offerTaskUndo({ groupId, taskId: task.id, title: task.title, label: completedText(task.title) });
        return result;
      }),
    [groupId, run],
  );

  const reopen = useCallback(
    (task: { id: string }) =>
      run(async () => {
        const result = await reopenTask(getSync(), task.id);
        return result;
      }),
    [run],
  );

  return { complete, reopen, busy, error };
}

/** Undo one tick: reopens just that task, and drops only its offer. */
export async function undoTaskTick(key: string, taskId: string) {
  const result = await reopenTask(getSync(), taskId);
  if (result.ok) clearTaskUndo(key);
  return result;
}
