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
export function applyUpdate(
  worker: WaitingWorker,
  container: Pick<WorkerContainer, "addEventListener">,
  reload: () => void,
) {
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

/** The parts of a registration `reloadToLatest` uses. */
type UpdatableRegistration = Pick<ServiceWorkerRegistration, "update"> & {
  waiting: WaitingWorker | null;
  installing: WaitingWorker | null;
};

/** The container `reloadToLatest` asks (a parameter, so tests pass a fake). */
export type UpdatableContainer = Pick<WorkerContainer, "addEventListener"> & {
  getRegistration(): Promise<UpdatableRegistration | undefined>;
};

/** How long a reload waits for a new version to finish installing before going ahead without it. */
export const INSTALL_WAIT_MS = 10_000;

/** Resolves once `worker` has installed; false if it fails or takes too long. */
const finishesInstalling = (worker: WaitingWorker) =>
  new Promise<boolean>((resolve) => {
    if (worker.state !== "installing") return resolve(worker.state === "installed");
    const timer = setTimeout(() => resolve(false), INSTALL_WAIT_MS);
    worker.addEventListener("statechange", () => {
      if (worker.state === "installing") return;
      clearTimeout(timer);
      resolve(worker.state === "installed");
    });
  });

/** The newest installed version the server has for this page, or null. */
const latestWorker = async (registration: UpdatableRegistration) => {
  try {
    await registration.update();
  } catch {
    // Couldn't ask: a version already waiting is still newer than this page.
  }
  const { installing } = registration;
  if (installing && (await finishesInstalling(installing))) return installing;
  return registration.waiting;
};

/**
 * A reload that reaches the current version. A plain reload is answered by the
 * worker controlling this page, with the same old bundle, so this asks the
 * server for a new worker and hands over to it first. With no worker (native,
 * the dev server) or no new version it's a plain reload.
 */
export async function reloadToLatest(container: UpdatableContainer | undefined, reload: () => void) {
  let worker: WaitingWorker | null = null;
  try {
    const registration = await container?.getRegistration();
    if (registration) worker = await latestWorker(registration);
  } catch {
    // No registration to ask: reload as it is.
  }
  if (worker && container) applyUpdate(worker, container, reload);
  else reload();
}
