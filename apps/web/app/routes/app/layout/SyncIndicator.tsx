import type { SyncState } from "~/lib/sync";

import { CloudAlert, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { Link } from "react-router";
import { Badge, ICON_SM } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useSyncState } from "~/lib/sync";

/**
 * A quiet note in the header when changes aren't reaching the server yet:
 * "Offline" (they're saved on this device and sync later), with how many
 * wait, "Can't sync, retrying" (the server failed on a change, B-286), or
 * "Syncing…". Then "N not saved" when the server refused changes,
 * a link to Settings → Changes not saved. Nothing when all is well.
 */
export function SyncIndicator() {
  const state = useSyncState();
  if (!state) return null;
  return (
    <span className="flex items-center gap-1">
      <ConnectionBadge state={state} />
      {state.notSaved > 0 && (
        <Link to={appUrls.settings("not-saved")} className="inline-flex" data-not-saved-link="">
          <Badge tone="warning" icon={CloudAlert}>
            {state.notSaved} not saved
          </Badge>
        </Link>
      )}
    </span>
  );
}

function ConnectionBadge({ state }: { state: SyncState }) {
  if (!state.connected)
    return (
      <span className="inline-flex" role="status" title="Changes are saved on this device and sync later">
        <Badge icon={CloudOff}>{state.waiting > 0 ? `Offline · ${state.waiting} waiting` : "Offline"}</Badge>
      </span>
    );
  if (state.uploadFailed)
    return (
      <span
        className="inline-flex"
        role="status"
        title="The server couldn't save a change. It tries again soon."
      >
        <Badge tone="warning" icon={TriangleAlert}>
          {state.waiting > 0 ? `Can't sync, retrying · ${state.waiting} waiting` : "Can't sync, retrying"}
        </Badge>
      </span>
    );
  if (state.uploading || (state.downloading && !state.hasSynced))
    return (
      <span className="inline-flex" role="status">
        <Badge>
          <RefreshCw aria-hidden className={`${ICON_SM} animate-spin`} />
          Syncing…
        </Badge>
      </span>
    );
  return (
    <span role="status" className="sr-only">
      All changes synced
    </span>
  );
}
