// The page's side of the service worker (B-144): registration, and the waiting
// worker the update notice shows (routes/app/layout/UpdateNotice.tsx).
import { SKIP_WAITING } from "./serviceWorkerRoutes";

/** The parts of `ServiceWorkerContainer` used here (a parameter, so tests pass a fake). */
export type WorkerContainer = Pick<ServiceWorkerContainer, "register" | "controller" | "addEventListener">;

/** The parts of a waiting `ServiceWorker` used here. */
export type WaitingWorker = Pick<ServiceWorker, "postMessage" | "state" | "addEventListener">;

let waiting: WaitingWorker | null = null;
const listeners = new Set<() => void>();

const setWaiting = (next: WaitingWorker | null) => {
  if (next === waiting) return;
  waiting = next;
  for (const listener of listeners) listener();
};

/** A new version, installed and waiting to take over; `null` when there's none. Read with `useWaitingWorker`. */
export const waitingWorker = {
  get: () => waiting,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** For tests: pretend a worker is (or isn't) waiting. */
  set: setWaiting,
};

/**
 * Registers /sw.js and tracks a waiting worker: one already waiting at load,
 * or one that finishes installing while an older one controls this page.
 */
export async function registerServiceWorker(container: WorkerContainer) {
  const registration = await container.register("/sw.js", { scope: "/" });
  if (registration.waiting) setWaiting(registration.waiting);
  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    installing?.addEventListener("statechange", () => {
      // With no controller this is the first install, which activates at once.
      if (installing.state === "installed" && container.controller) setWaiting(installing);
    });
  });
  return registration;
}

/**
 * The notice's Reload: tell the waiting worker to take over, then reload once
 * it has (when this page's controller changes, or, on a page no worker
 * controlled, when it's activated), so the page loads the new version.
 */
export function applyUpdate(worker: WaitingWorker, container: WorkerContainer, reload: () => void) {
  let done = false;
  const once = () => {
    if (done) return;
    done = true;
    reload();
  };
  container.addEventListener("controllerchange", once);
  worker.addEventListener("statechange", () => {
    if (worker.state === "activated") once();
  });
  worker.postMessage(SKIP_WAITING);
}
