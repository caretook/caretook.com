import type { ActionResult } from "~/lib/core/api";

import { PROFILE_NEEDS_CONNECTION } from "~/lib/profiles/recipientDisplay";
import { useOnline } from "./profileSheet";

/**
 * The foot of a writers' sheet (Contact, Insurance): "Needs a connection"
 * while offline, the save's error, then Cancel and Save. Save is disabled
 * while saving and while offline (every profile write is online only).
 */
export function SheetButtons({
  busy,
  result,
  onCancel,
}: {
  busy: boolean;
  result: ActionResult | undefined;
  onCancel: () => void;
}) {
  const online = useOnline();
  return (
    <>
      {!online && (
        <p className="text-base-content/70 text-sm" data-needs-connection="">
          {PROFILE_NEEDS_CONNECTION}
        </p>
      )}
      {result && !result.ok && (
        <p role="alert" className="text-error text-sm">
          {result.error}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-3">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy || !online}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </>
  );
}
