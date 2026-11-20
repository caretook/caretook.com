import type { DeviceAnnouncement } from "~/lib/admin/announcement";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ANNOUNCEMENT_REFETCH_MS,
  cacheAnnouncement,
  msUntilEnd,
  parseDeviceAnnouncement,
  pickAnnouncement,
  readCachedAnnouncement,
  readDismissed,
  saveDismissed,
  withDismissed,
} from "~/lib/admin/announcement";
import { rpc } from "~/lib/core/rpc";

/** Long timers are capped (setTimeout overflows past ~24.8 days); the banner re-checks then. */
const MAX_WAIT_MS = 86_400_000;

/**
 * The announcement to show above /app's outlet, and `dismiss`. Asks
 * `public.announcement` when /app mounts, when the browser comes back
 * online, and on navigation at most once a minute (`key`, the pathname);
 * keeps the answer on the device, and shows the cached one while the server
 * can't be reached. Hides it when it ends, without a reload.
 */
export function useAnnouncement(key: string) {
  const [cached, setCached] = useState<DeviceAnnouncement | null>(() => readCachedAnnouncement());
  const [fetched, setFetched] = useState<DeviceAnnouncement | null | undefined>(undefined);
  const [dismissed, setDismissed] = useState<string[]>(() => readDismissed());
  const [now, setNow] = useState(() => Date.now());
  const lastAsked = useRef(0);

  const ask = useCallback((force: boolean) => {
    const at = Date.now();
    if (!force && at - lastAsked.current < ANNOUNCEMENT_REFETCH_MS) return;
    lastAsked.current = at;
    rpc.public
      .announcement()
      .then((answer) => {
        const value = answer ? parseDeviceAnnouncement(answer) : null;
        cacheAnnouncement(value);
        setCached(value);
        setFetched(value);
        setNow(Date.now());
      })
      .catch(() => {
        // Offline or the server's down: keep showing the cached one.
        setFetched(undefined);
      });
  }, []);

  useEffect(() => {
    ask(lastAsked.current === 0);
  }, [ask, key]);

  useEffect(() => {
    const online = () => ask(true);
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [ask]);

  const shown = pickAnnouncement({ fetched, cached, dismissed, now });

  // Re-check when it ends, so it goes on time offline too.
  const wait = msUntilEnd(shown, now);
  useEffect(() => {
    if (wait === null) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(wait + 50, MAX_WAIT_MS));
    return () => clearTimeout(timer);
  }, [wait, shown?.id]);

  const dismiss = useCallback(() => {
    if (!shown) return;
    setDismissed((list) => {
      const next = withDismissed(list, shown.id);
      saveDismissed(next);
      return next;
    });
  }, [shown]);

  return { announcement: shown, dismiss };
}
