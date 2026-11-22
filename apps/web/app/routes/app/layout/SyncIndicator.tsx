import type { SyncState } from "~/lib/sync";

import { CloudAlert, CloudOff, RefreshCw } from "lucide-react";
import { Link } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useSyncState } from "~/lib/sync";

/**
 * A quiet note in the header when changes aren't reaching the server yet:
 * "Offline" (they're saved on this device and sync later), with how many
 * wait, or "Syncing…". Then "N not saved" when the server refused changes,
 * a link to Settings → Changes not saved. Nothing when all is well.
 */
export function SyncIndicator() {
  const state = useSyncState();
  if (!state) return null;
  return (
    <span className="flex items-center gap-1">
      <ConnectionBadge state={state} />
      {state.notSaved > 0 && (
        <Link
          to={appUrls.settings("not-saved")}
          className="badge badge-warning badge-soft gap-1"
          data-not-saved-link=""
        >
          <CloudAlert aria-hidden className="size-3.5" />
          {state.notSaved} not saved
        </Link>
      )}
    </span>
  );
}

function ConnectionBadge({ state }: { state: SyncState }) {
  if (!state.connected)
    return (
      <span
        className="badge badge-ghost gap-1"
        role="status"
        title="Changes are saved on this device and sync later"
      >
        <CloudOff aria-hidden className="size-3.5" />
        {state.waiting > 0 ? `Offline · ${state.waiting} waiting` : "Offline"}
      </span>
    );
  if (state.uploading || (state.downloading && !state.hasSynced))
    return (
      <span className="badge badge-ghost gap-1" role="status">
        <RefreshCw aria-hidden className="size-3.5 animate-spin" />
        Syncing…
      </span>
    );
  return (
    <span role="status" className="sr-only">
      All changes synced
    </span>
  );
}
