import { useEffect, useState, useSyncExternalStore } from "react";
import { clearUndo, subscribeUndo, undoFor, undoSnapshot } from "~/lib/passUndo";
import { undoPassLog } from "./usePassLog";

const noOffer = () => null;

/**
 * The Undo after Given all: "Morning logged · Undo" in one polite status
 * line for about 10 s (`lib/passUndo.ts`), for this group's last round.
 * Undo soft-deletes exactly the doses it wrote; the pass is open again.
 * The live region is always rendered (empty when there's nothing to undo),
 * so the announcement isn't lost. Today, the Dose sheet and the timeline's
 * medication strip each mount one.
 */
export function PassUndoStatus({ groupId, className = "" }: { groupId: string; className?: string }) {
  const offer = useSyncExternalStore(subscribeUndo, undoSnapshot, noOffer);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = offer ? undoFor(groupId) : null;

  // Clears itself when its time is up.
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => clearUndo(shown.key), Math.max(0, shown.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [shown]);

  return (
    <div role="status" aria-live="polite" className={className} data-pass-undo={shown ? "" : undefined}>
      {shown && (
        <p className="alert alert-info alert-soft flex items-center justify-between gap-3 py-2 text-sm">
          <span data-pass-undo-label>{shown.label}</span>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={busy}
            data-pass-undo-button
            onClick={() => {
              setBusy(true);
              setError(null);
              void undoPassLog(shown.key, shown.doseIds)
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
