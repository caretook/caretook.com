import { describe, expect, it, vi, type Mock } from "vitest";

import {
  applyUpdate,
  registerServiceWorker,
  reloadToLatest,
  waitingWorker,
  type UpdatableContainer,
  type WorkerContainer,
} from "./serviceWorkerRegister";

/** A minimal event target with a writable `state`. */
function fakeWorker(state: ServiceWorkerState = "installed") {
  const target = new EventTarget();
  const worker = Object.assign(target, { state, postMessage: vi.fn() });
  return worker as unknown as Omit<ServiceWorker, "state" | "postMessage"> & {
    state: ServiceWorkerState;
    postMessage: Mock;
  };
}

function fakeContainer(registration: object, controller: object | null = {}) {
  const target = new EventTarget();
  return Object.assign(target, {
    controller,
    register: vi.fn(() => Promise.resolve(registration)),
  }) as unknown as WorkerContainer & EventTarget;
}

describe("registerServiceWorker", () => {
  it("registers /sw.js at the root and reports a worker already waiting", async () => {
    waitingWorker.set(null);
    const waiting = fakeWorker();
    const registration = Object.assign(new EventTarget(), { waiting, installing: null });
    const container = fakeContainer(registration);
    await registerServiceWorker(container);
    expect(container.register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
    expect(waitingWorker.get()).toBe(waiting);
  });

  it("reports an update that finishes installing, but not a first install", async () => {
    for (const [controller, expected] of [
      [{}, true],
      [null, false],
    ] as const) {
      waitingWorker.set(null);
      const installing = fakeWorker("installing");
      const registration = Object.assign(new EventTarget(), { waiting: null, installing });
      await registerServiceWorker(fakeContainer(registration, controller));
      registration.dispatchEvent(new Event("updatefound"));
      installing.state = "installed";
      installing.dispatchEvent(new Event("statechange"));
      expect(waitingWorker.get() === installing).toBe(expected);
    }
  });
});

describe("applyUpdate", () => {
  it("posts skip-waiting, then reloads once when the controller changes", () => {
    const worker = fakeWorker();
    const container = fakeContainer({});
    const reload = vi.fn();
    applyUpdate(worker, container, reload);
    expect(worker.postMessage).toHaveBeenCalledWith("skip-waiting");
    expect(reload).not.toHaveBeenCalled();
    container.dispatchEvent(new Event("controllerchange"));
    worker.state = "activated";
    worker.dispatchEvent(new Event("statechange"));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads on activation when no worker controlled the page", () => {
    const worker = fakeWorker();
    const reload = vi.fn();
    applyUpdate(worker, fakeContainer({}, null), reload);
    worker.state = "activating";
    worker.dispatchEvent(new Event("statechange"));
    expect(reload).not.toHaveBeenCalled();
    worker.state = "activated";
    worker.dispatchEvent(new Event("statechange"));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe("reloadToLatest", () => {
  const containerWith = (registration: object | undefined) =>
    Object.assign(new EventTarget(), {
      getRegistration: vi.fn(() => Promise.resolve(registration)),
    }) as unknown as UpdatableContainer & EventTarget;
  const registrationWith = (workers: { waiting?: object | null; installing?: object | null }) => ({
    waiting: null,
    installing: null,
    update: vi.fn(() => Promise.resolve()),
    ...workers,
  });

  it("is a plain reload with no service worker or no registration", async () => {
    const reload = vi.fn();
    await reloadToLatest(undefined, reload);
    await reloadToLatest(containerWith(undefined), reload);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("is a plain reload when the server has no new version", async () => {
    const reload = vi.fn();
    const registration = registrationWith({});
    await reloadToLatest(containerWith(registration), reload);
    expect(registration.update).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("hands over to a waiting version before reloading", async () => {
    const reload = vi.fn();
    const waiting = fakeWorker();
    const container = containerWith(registrationWith({ waiting }));
    await reloadToLatest(container, reload);
    expect(waiting.postMessage).toHaveBeenCalledWith("skip-waiting");
    expect(reload).not.toHaveBeenCalled();
    container.dispatchEvent(new Event("controllerchange"));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("still hands over to a waiting version when it can't reach the server", async () => {
    const reload = vi.fn();
    const waiting = fakeWorker();
    const registration = registrationWith({ waiting });
    registration.update.mockRejectedValueOnce(new TypeError("offline"));
    await reloadToLatest(containerWith(registration), reload);
    expect(waiting.postMessage).toHaveBeenCalledWith("skip-waiting");
  });

  it("waits for a version still installing, then hands over to it", async () => {
    const reload = vi.fn();
    const installing = fakeWorker("installing");
    const container = containerWith(registrationWith({ installing }));
    const done = reloadToLatest(container, reload);
    await new Promise((resolve) => setTimeout(resolve));
    installing.state = "installed";
    installing.dispatchEvent(new Event("statechange"));
    await done;
    expect(installing.postMessage).toHaveBeenCalledWith("skip-waiting");
  });

  it("reloads anyway when the new version fails to install", async () => {
    const reload = vi.fn();
    const installing = fakeWorker("installing");
    const done = reloadToLatest(containerWith(registrationWith({ installing })), reload);
    await new Promise((resolve) => setTimeout(resolve));
    installing.state = "redundant";
    installing.dispatchEvent(new Event("statechange"));
    await done;
    expect(installing.postMessage).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
