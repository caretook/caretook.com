import { CloudOff } from "lucide-react";
import { useSyncState } from "~/lib/sync";

export const OFFLINE_TEXT = "You're offline. Changes save on this device and sync when you reconnect.";

/**
 * A strip under the header on every /app page while the device is offline
 * (B-804): the same connection state the header's `SyncIndicator` reads,
 * never a second source. Not dismissable; it goes when the connection is
 * back. In the page's flow (not fixed), so it never covers the header, the
 * tab bar or a sheet. The live region stays mounted and only its content
 * changes, so going offline is announced once.
 */
export function OfflineBanner() {
  const state = useSyncState();
  const offline = !!state && !state.connected;
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
