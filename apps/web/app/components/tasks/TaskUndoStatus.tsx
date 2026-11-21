import { useEffect, useState, useSyncExternalStore } from "react";
import {
  pruneTaskUndo,
  subscribeTaskUndo,
  type TaskUndo,
  taskUndoFor,
  taskUndoSnapshot,
} from "~/lib/tasks/taskUndo";
import { undoTaskTick } from "./useTaskTick";

const NO_OFFERS: readonly TaskUndo[] = [];
const noOffers = () => NO_OFFERS;

/**
 * The Undo after each tick: "Done: Call the pharmacy · Undo" in one polite
 * status region for about 10 s from that tick (`lib/tasks/taskUndo.ts`),
 * for this group's ticks, newest first, each line with its own Undo
 * (named "Undo <title>") that reopens only that task. The region is always
 * rendered (empty when there's nothing to undo), so the announcement isn't
 * lost, and it's a list even for one line, with `aria-atomic="false"` and
 * additions only, so a new tick announces just its own line.
 */
export function TaskUndoStatus({ groupId, className = "" }: { groupId: string; className?: string }) {
  const all = useSyncExternalStore(subscribeTaskUndo, taskUndoSnapshot, noOffers);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  const shown = all.length ? taskUndoFor(groupId) : [];
  const nextExpiry = shown.length ? Math.min(...shown.map((o) => o.expiresAt)) : null;

  // Each line clears itself when its time is up.
  useEffect(() => {
    if (nextExpiry === null) return;
    const timer = setTimeout(() => pruneTaskUndo(), Math.max(0, nextExpiry - Date.now()));
    return () => clearTimeout(timer);
  }, [nextExpiry]);

  const undo = (offer: TaskUndo) => {
    setBusy((keys) => new Set(keys).add(offer.key));
    setError(null);
    void undoTaskTick(offer.key, offer.taskId)
      .then((result) => !result.ok && setError(result.error))
      .finally(() =>
        setBusy((keys) => {
          const next = new Set(keys);
          next.delete(offer.key);
          return next;
        }),
      );
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      aria-relevant="additions"
      className={className}
      data-task-undo={shown.length ? "" : undefined}
    >
      {shown.length > 0 && (
        <ul className="alert alert-info alert-soft flex flex-col items-stretch gap-1 py-2 text-sm">
          {shown.map((offer) => (
            <li key={offer.key} className="flex items-center justify-between gap-3" data-task-undo-line>
              <span data-task-undo-label>{offer.label}</span>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                aria-label={`Undo ${offer.title}`}
                disabled={busy.has(offer.key)}
                data-task-undo-button
                onClick={() => undo(offer)}
              >
                Undo
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-error text-sm">{error}</p>}
    </div>
  );
}
