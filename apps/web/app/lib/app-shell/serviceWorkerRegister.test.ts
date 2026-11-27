import { describe, expect, it, vi, type Mock } from "vitest";

import {
  applyUpdate,
  registerServiceWorker,
  reloadToLatest,
  UPDATE_CHECK_EVERY_MS,
  UPDATE_CHECK_THROTTLE_MS,
  waitingWorker,
  type UpdatableContainer,
  type UpdateClock,
  type UpdatePage,
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

describe("registerServiceWorker's update checks", () => {
  /** A page whose visibility the test flips, firing `visibilitychange`. */
  function fakePage(visibilityState: DocumentVisibilityState = "visible") {
    const page = Object.assign(new EventTarget(), { visibilityState });
    return Object.assign(page, {
      show: () => {
        page.visibilityState = "visible";
        page.dispatchEvent(new Event("visibilitychange"));
      },
      hide: () => {
        page.visibilityState = "hidden";
        page.dispatchEvent(new Event("visibilitychange"));
      },
    }) as unknown as UpdatePage & { show(): void; hide(): void };
  }

  /** A clock the test moves by hand; `advance` runs the interval each time it's due. */
  function fakeClock() {
    let time = 1_000_000;
    let tick: { run: () => void; every: number; next: number } | null = null;
    const clock: UpdateClock & { advance(ms: number): void; ticking(): boolean } = {
      now: () => time,
      setInterval: (run, every) => {
        tick = { run, every, next: time + every };
        return 1;
      },
      clearInterval: () => {
        tick = null;
      },
      advance(ms) {
        const end = time + ms;
        while (tick && tick.next <= end) {
          time = tick.next;
          tick.next += tick.every;
          tick.run();
        }
        time = end;
      },
      ticking: () => tick !== null,
    };
    return clock;
  }

  const registrationWith = (update = vi.fn(() => Promise.resolve())) =>
    Object.assign(new EventTarget(), { waiting: null, installing: null as unknown, update });

  it("asks for an update when the page becomes visible again", async () => {
    const registration = registrationWith();
    const page = fakePage();
    const clock = fakeClock();
    await registerServiceWorker(fakeContainer(registration), page, clock);
    page.hide();
    clock.advance(UPDATE_CHECK_THROTTLE_MS);
    page.show();
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it("asks once for a burst of visibility changes inside the throttle", async () => {
    const registration = registrationWith();
    const page = fakePage();
    const clock = fakeClock();
    await registerServiceWorker(fakeContainer(registration), page, clock);
    clock.advance(UPDATE_CHECK_THROTTLE_MS);
    page.hide();
    page.show();
    clock.advance(UPDATE_CHECK_THROTTLE_MS - 1);
    page.hide();
    page.show();
    expect(registration.update).toHaveBeenCalledTimes(1);
    clock.advance(1);
    page.hide();
    page.show();
    expect(registration.update).toHaveBeenCalledTimes(2);
  });

  it("asks on the interval while visible, not while hidden", async () => {
    const registration = registrationWith();
    const page = fakePage();
    const clock = fakeClock();
    await registerServiceWorker(fakeContainer(registration), page, clock);
    clock.advance(UPDATE_CHECK_EVERY_MS);
    expect(registration.update).toHaveBeenCalledTimes(1);
    page.hide();
    clock.advance(UPDATE_CHECK_EVERY_MS);
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it("swallows a failed check and asks again next time", async () => {
    const update = vi.fn(() => Promise.resolve());
    update.mockRejectedValueOnce(new TypeError("offline"));
    const registration = registrationWith(update);
    const clock = fakeClock();
    await registerServiceWorker(fakeContainer(registration), fakePage(), clock);
    clock.advance(UPDATE_CHECK_EVERY_MS);
    await new Promise((resolve) => setTimeout(resolve));
    clock.advance(UPDATE_CHECK_EVERY_MS);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("shows the notice for a version found after resuming", async () => {
    waitingWorker.set(null);
    const installing = fakeWorker("installing");
    const registration = registrationWith();
    registration.update.mockImplementation(() => {
      registration.installing = installing;
      registration.dispatchEvent(new Event("updatefound"));
      return Promise.resolve();
    });
    const page = fakePage("hidden");
    const clock = fakeClock();
    await registerServiceWorker(fakeContainer(registration), page, clock);
    clock.advance(UPDATE_CHECK_THROTTLE_MS);
    page.show();
    installing.state = "installed";
    installing.dispatchEvent(new Event("statechange"));
    expect(waitingWorker.get()).toBe(installing);
  });

  it("keeps one set of checks when registered again", async () => {
    const first = registrationWith();
    const second = registrationWith();
    const page = fakePage();
    const clock = fakeClock();
    await registerServiceWorker(fakeContainer(first), page, clock);
    await registerServiceWorker(fakeContainer(second), page, clock);
    clock.advance(UPDATE_CHECK_EVERY_MS);
    page.hide();
    clock.advance(UPDATE_CHECK_THROTTLE_MS);
    page.show();
    expect(first.update).not.toHaveBeenCalled();
    expect(second.update).toHaveBeenCalledTimes(2);
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
