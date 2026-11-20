import { useEffect, useState, useSyncExternalStore } from "react";
import { clearTaskUndo, subscribeTaskUndo, taskUndoFor, taskUndoSnapshot } from "~/lib/taskUndo";
import { undoTaskTick } from "./useTaskTick";

const noOffer = () => null;

/**
 * The Undo after a tick: "Done: Call the pharmacy · Undo" in one polite
 * status line for about 10 s (`lib/taskUndo.ts`), for this group's last
 * tick. Undo reopens the task. The live region is always rendered (empty
 * when there's nothing to undo), so the announcement isn't lost.
 */
export function TaskUndoStatus({ groupId, className = "" }: { groupId: string; className?: string }) {
  const offer = useSyncExternalStore(subscribeTaskUndo, taskUndoSnapshot, noOffer);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = offer ? taskUndoFor(groupId) : null;

  // Clears itself when its time is up.
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => clearTaskUndo(shown.key), Math.max(0, shown.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [shown]);

  return (
    <div role="status" aria-live="polite" className={className} data-task-undo={shown ? "" : undefined}>
      {shown && (
        <p className="alert alert-info alert-soft flex items-center justify-between gap-3 py-2 text-sm">
          <span data-task-undo-label>{shown.label}</span>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={busy}
            data-task-undo-button
            onClick={() => {
              setBusy(true);
              setError(null);
              void undoTaskTick(shown.key, shown.taskId)
                .then((result) => !result.ok && setError(result.error))
                .finally(() => setBusy(false));
            }}
          >
            Undo
          </button>
        </p>
      )}
      {error && <p className="text-error text-sm">{error}</p>}
    </div>
  );
}
