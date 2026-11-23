import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "~/components/ui";
import { clearUndo, subscribeUndo, undoFor, undoSnapshot } from "~/lib/medications/passUndo";
import { undoPassLog } from "./usePassLog";

const noOffer = () => null;

/**
 * The Undo after Given all: "Morning logged · Undo" in one polite status
 * line for about 10 s (`lib/medications/passUndo.ts`), for this group's last round.
 * Undo soft-deletes exactly the doses it wrote; the pass is open again
 * (quick entry's: every entry its line wrote).
 * The live region is always rendered (empty when there's nothing to undo),
 * so the announcement isn't lost. Today, the Dose sheet and the timeline's
 * medication strip each mount one.
 */
export function PassUndoStatus({
  groupId,
  place = null,
  className = "",
}: {
  groupId: string;
  /** Show only offers made here (`offerUndo`'s `place`); left out, Given all's from the medication screens. */
  place?: string | null;
  className?: string;
}) {
  const offer = useSyncExternalStore(subscribeUndo, undoSnapshot, noOffer);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = offer ? undoFor(groupId, { place }) : null;

  // Clears itself when its time is up.
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => clearUndo(shown.key), Math.max(0, shown.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [shown]);

  return (
    <div role="status" aria-live="polite" className={className} data-pass-undo={shown ? "" : undefined}>
      {shown && (
        <p className="rounded-box bg-info/10 flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span data-pass-undo-label>{shown.label}</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            data-pass-undo-button=""
            onClick={() => {
              setBusy(true);
              setError(null);
              void undoPassLog(shown.key, shown.doseIds, shown.entryIds)
                .then((result) => !result.ok && setError(result.error))
                .finally(() => setBusy(false));
            }}
          >
            Undo
          </Button>
        </p>
      )}
      {error && <p className="text-error-ink text-sm">{error}</p>}
    </div>
  );
}
