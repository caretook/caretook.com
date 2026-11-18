import { CloudOff, RefreshCw } from "lucide-react";
import { useSyncState } from "~/lib/sync";

/**
 * A quiet note in the header when changes aren't reaching the server yet:
 * "Offline" (they're saved on this device and sync later) or "Syncing…".
 * Nothing when all is well.
 */
export function SyncIndicator() {
  const state = useSyncState();
  if (!state) return null;

  if (!state.connected)
    return (
      <span
        className="badge badge-ghost gap-1"
        role="status"
        title="Changes are saved on this device and sync later"
      >
        <CloudOff aria-hidden className="size-3.5" />
        Offline
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
