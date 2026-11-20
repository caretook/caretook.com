import { useState, useSyncExternalStore } from "react";
import { applyUpdate, waitingWorker } from "~/lib/app-shell/serviceWorkerRegister";

/**
 * The update notice's state: whether a new version is waiting, and Reload,
 * which hands over to it and reloads once it has taken over.
 */
export function useUpdateNotice() {
  const worker = useSyncExternalStore(waitingWorker.subscribe, waitingWorker.get, () => null);
  const [reloading, setReloading] = useState(false);
  const reload = () => {
    if (!worker || reloading) return;
    setReloading(true);
    applyUpdate(worker, navigator.serviceWorker, () => window.location.reload());
  };
  return { ready: worker !== null, reloading, reload };
}
