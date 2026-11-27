import { CloudOff } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Notice } from "~/components/ui";
import { useSyncState } from "~/lib/sync";

export const OFFLINE_TEXT = "You're offline. Changes save on this device and sync when you reconnect.";

/**
 * How long the device must stay not connected, with the browser offline
 * (`navigator.onLine` false), before the banner shows. A cold load is "not
 * connected" until PowerSync connects, and a drop waits PowerSync's retry
 * delay (`retryDelayMs`, 5 s ± 10% by default) before it reconnects (B-840):
 * the grace outlasts that delay plus a reconnect.
 */
export const OFFLINE_GRACE_MS = 10_000;

/**
 * The same, while the browser says it's online (B-904): PowerSync drops
 * `connected` whenever its sync stream ends, and with the network up that's
 * the sync service, not the device: its restart, a closed stream, a reconnect
 * stretched past one retry by a loaded machine, or the network gone in a way
 * the browser can't see. Only a drop past PowerSync's own connect timeout
 * (30 s), with its retries failing, shows the strip then.
 */
export const UNREACHABLE_GRACE_MS = 30_000;

/**
 * On the dev server the local PowerSync container and the dev server itself
 * restart under you (`docker compose restart powersync`, `risa serve
 * --restart`), and a busy machine stretches each reconnect: the drops that
 * showed the strip at random while online (B-904). Dev only; production keeps
 * `UNREACHABLE_GRACE_MS`.
 */
export const DEV_UNREACHABLE_GRACE_MS = 90_000;

/**
 * A strip under the header on every /app page while the device is offline
 * (B-804): the same connection state the header's `SyncIndicator` reads,
 * never a second source, once it has been not connected for
 * `OFFLINE_GRACE_MS` with the browser offline, or for `UNREACHABLE_GRACE_MS`
 * while the browser says it's online (from mount or from the drop). Not
 * dismissable; it goes at once when the connection is back. A kit `Notice`
 * overlaid just under the header (B-905): its anchor takes no height, so
 * showing it never moves the page; it scrolls with the page, so it never
 * covers the header, and its layer (`z-30`) stays under the tab bar (`z-40`)
 * and sheets (`z-50`). The live region stays mounted and only its content
 * changes, so going offline is announced once.
 */
export function OfflineBanner() {
  const state = useSyncState();
  const offline = useOfflineAfterGrace(!!state && !state.connected, useBrowserOnline());
  return (
    <div data-offline-anchor="" className="relative h-0 print:hidden">
      <div
        role="status"
        data-offline-banner=""
        className="pointer-events-none absolute inset-x-0 top-0 z-30 px-4 sm:px-6"
      >
        {offline && (
          <Notice
            tone="warning"
            icon={CloudOff}
            role="none"
            data-offline-strip=""
            className="pointer-events-auto mx-auto mt-2 max-w-2xl shadow-md"
          >
            {OFFLINE_TEXT}
          </Notice>
        )}
      </div>
    </div>
  );
}

const subscribeOnline = (onChange: () => void) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

/** The browser's own idea of a connection (`navigator.onLine`); online on the server. */
const useBrowserOnline = () =>
  useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );

/** How long a drop must hold before the banner shows, by what the browser says. */
export const offlineGraceMs = (browserOnline: boolean, dev = import.meta.env.DEV) =>
  browserOnline ? (dev ? DEV_UNREACHABLE_GRACE_MS : UNREACHABLE_GRACE_MS) : OFFLINE_GRACE_MS;

/**
 * `offline`, once it has held for its grace (`offlineGraceMs`), counted from
 * the drop (or mount): the browser going offline mid-drop shortens what's
 * left, never restarts it. False at once when it ends.
 */
function useOfflineAfterGrace(offline: boolean, browserOnline: boolean) {
  const [graceOver, setGraceOver] = useState(false);
  const since = useRef(0);
  useEffect(() => {
    if (!offline) return;
    since.current = Date.now();
    return () => setGraceOver(false);
  }, [offline]);
  const grace = offlineGraceMs(browserOnline);
  useEffect(() => {
    if (!offline) return;
    const timer = setTimeout(() => setGraceOver(true), Math.max(0, since.current + grace - Date.now()));
    return () => clearTimeout(timer);
  }, [offline, grace]);
  return offline && graceOver;
}
