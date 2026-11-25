import { useEffect, useSyncExternalStore } from "react";
import { dismissToast, toast } from "~/components/ui";
import { applyUpdate, waitingWorker } from "~/lib/app-shell/serviceWorkerRegister";

/**
 * The update notice: while a new version waits, a toast whose Reload hands
 * over to it and reloads once it has taken over. Reload runs once (the toast
 * closes); the toast goes when the waiting worker does.
 */
export function useUpdateNotice() {
  const worker = useSyncExternalStore(waitingWorker.subscribe, waitingWorker.get, () => null);
  useEffect(() => {
    if (!worker) return;
    const id = toast({
      message: "A new version is ready",
      action: {
        label: "Reload",
        onAction: () => applyUpdate(worker, navigator.serviceWorker, () => window.location.reload()),
      },
      timeout: null,
      data: { "data-update-notice": "" },
    });
    return () => dismissToast(id);
  }, [worker]);
}
