import type { PageLifecycle } from "./pageCache";

import { describe, expect, it, vi } from "vitest";
import { releaseSyncLocksWhenCached } from "./pageCache";

/** Exclusive locks by name, enough of `LockManager` for these tests. */
const fakeLocks = () => {
  const queues = new Map<string, (() => void)[]>();
  const heldNames = new Set<string>();
  const request = (name: string, ...rest: unknown[]) => {
    const callback = (typeof rest[0] === "function" ? rest[0] : rest[1]) as (lock: Lock) => unknown;
    return new Promise((resolve, reject) => {
      const run = () => {
        heldNames.add(name);
        Promise.resolve()
          .then(() => callback({ name, mode: "exclusive" }))
          .then(resolve, reject)
          .finally(() => {
            heldNames.delete(name);
            queues.get(name)?.shift()?.();
          });
      };
      if (heldNames.has(name)) queues.set(name, [...(queues.get(name) ?? []), run]);
      else run();
    });
  };
  return { locks: { request, query: vi.fn() } as unknown as LockManager, heldNames };
};

const fakePage = () => {
  const listeners: Record<string, ((e: PageTransitionEvent) => void)[]> = {};
  const reload = vi.fn();
  const page: PageLifecycle = {
    addEventListener: (type, listener) => (listeners[type] ??= []).push(listener),
    location: { reload },
  };
  const fire = (type: "pagehide" | "pageshow", persisted: boolean) =>
    listeners[type]?.forEach((l) => l({ persisted } as PageTransitionEvent));
  return { page, fire, reload };
};

const settle = () => new Promise((r) => setTimeout(r, 0));
const forever = () => new Promise(() => undefined);

describe("releaseSyncLocksWhenCached", () => {
  it("releases PowerSync's tab and connection locks when the page goes into the back/forward cache", async () => {
    const { locks, heldNames } = fakeLocks();
    const { page, fire } = fakePage();
    releaseSyncLocksWhenCached(locks, page);

    void locks.request("tab-close-signal-1", {}, forever);
    void locks.request("shared-connection-caretook.sqlite-1", forever);
    void locks.request("my-app-lock", {}, forever);
    await settle();
    expect([...heldNames].sort()).toEqual([
      "my-app-lock",
      "shared-connection-caretook.sqlite-1",
      "tab-close-signal-1",
    ]);

    fire("pagehide", true);
    await settle();
    // Only PowerSync's page-lifetime locks: anything else is left alone.
    expect([...heldNames]).toEqual(["my-app-lock"]);
  });

  it("lets a waiting context (the shared worker) take the released lock", async () => {
    const { locks } = fakeLocks();
    const { page, fire } = fakePage();
    releaseSyncLocksWhenCached(locks, page);

    void locks.request("tab-close-signal-2", forever);
    const workerNoticed = vi.fn();
    void locks.request("tab-close-signal-2", {}, workerNoticed);
    await settle();
    expect(workerNoticed).not.toHaveBeenCalled();

    fire("pagehide", true);
    await settle();
    expect(workerNoticed).toHaveBeenCalledOnce();
  });

  it("keeps the locks on an ordinary pagehide (unloading releases them anyway)", async () => {
    const { locks, heldNames } = fakeLocks();
    const { page, fire } = fakePage();
    releaseSyncLocksWhenCached(locks, page);

    void locks.request("tab-close-signal-3", {}, forever);
    await settle();
    fire("pagehide", false);
    await settle();
    expect([...heldNames]).toEqual(["tab-close-signal-3"]);
  });

  it("passes a lock's result through, and releases it when PowerSync does", async () => {
    const { locks, heldNames } = fakeLocks();
    const { page } = fakePage();
    releaseSyncLocksWhenCached(locks, page);

    await expect(locks.request("tab-close-signal-4", {}, () => "done")).resolves.toBe("done");
    await expect(locks.request("other", () => 42)).resolves.toBe(42);
    expect(heldNames.size).toBe(0);
  });

  it("reloads a page restored from the cache, and only then", () => {
    const { locks } = fakeLocks();
    const { page, fire, reload } = fakePage();
    releaseSyncLocksWhenCached(locks, page);

    fire("pageshow", false);
    expect(reload).not.toHaveBeenCalled();
    fire("pageshow", true);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("installs once per lock manager", async () => {
    const { locks, heldNames } = fakeLocks();
    const first = fakePage();
    const second = fakePage();
    releaseSyncLocksWhenCached(locks, first.page);
    releaseSyncLocksWhenCached(locks, second.page);

    void locks.request("tab-close-signal-5", {}, forever);
    await settle();
    second.fire("pagehide", true);
    await settle();
    expect([...heldNames]).toEqual(["tab-close-signal-5"]);
    first.fire("pagehide", true);
    await settle();
    expect(heldNames.size).toBe(0);
  });
});
