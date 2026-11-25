import { CloudOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useSyncState } from "~/lib/sync";

export const OFFLINE_TEXT = "You're offline. Changes save on this device and sync when you reconnect.";

/**
 * How long the device must stay not connected before the banner shows: a cold
 * load is "not connected" until PowerSync connects, and a strip that appears
 * and goes would shift the page on every start.
 */
export const OFFLINE_GRACE_MS = 3000;

/**
 * A strip under the header on every /app page while the device is offline
 * (B-804): the same connection state the header's `SyncIndicator` reads,
 * never a second source, once it has been offline for `OFFLINE_GRACE_MS`
 * (from mount or from the drop). Not dismissable; it goes at once when the
 * connection is back. In the page's flow (not fixed), so it never covers the header, the
 * tab bar or a sheet. The live region stays mounted and only its content
 * changes, so going offline is announced once.
 */
export function OfflineBanner() {
  const state = useSyncState();
  const offline = useOfflineAfterGrace(!!state && !state.connected);
  return (
    <div role="status" data-offline-banner="" className="print:hidden">
      {offline && (
        <p className="flex items-center gap-2 border-b border-warning/40 bg-warning/15 px-4 py-2 text-sm text-base-content sm:px-6">
          <CloudOff aria-hidden className="size-4 shrink-0" />
          <span className="min-w-0">{OFFLINE_TEXT}</span>
        </p>
      )}
    </div>
  );
}

/** `offline`, once it has held for `OFFLINE_GRACE_MS`; false at once when it ends. */
function useOfflineAfterGrace(offline: boolean) {
  const [graceOver, setGraceOver] = useState(false);
  useEffect(() => {
    if (!offline) return;
    const timer = setTimeout(() => setGraceOver(true), OFFLINE_GRACE_MS);
    return () => {
      clearTimeout(timer);
      setGraceOver(false);
    };
  }, [offline]);
  return offline && graceOver;
}
