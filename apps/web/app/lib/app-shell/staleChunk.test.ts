import { describe, expect, it, vi } from "vitest";

import {
  GUARD_MS,
  HAND_OFF_KEY,
  RELOAD_KEY,
  claimReload,
  handOff,
  reloadToTarget,
  takeHandOff,
  watchStaleChunks,
  type ReloadEnv,
  type StaleChunkWindow,
} from "./staleChunk";

/** A session store backed by a Map. */
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

const web = (storage: ReturnType<typeof memoryStorage>, now: number): ReloadEnv => ({
  build: "web",
  storage,
  now,
});

describe("reloadToTarget", () => {
  it("reloads to the target once, and not again within the guard", () => {
    const storage = memoryStorage();
    const go = vi.fn();
    expect(reloadToTarget("/app/groups/g1/providers", web(storage, 1_000), go)).toBe(true);
    expect(go).toHaveBeenCalledExactlyOnceWith("/app/groups/g1/providers");
    // The reloaded page fails again: no second reload, no loop.
    expect(reloadToTarget("/app/groups/g1/providers", web(storage, 1_000 + GUARD_MS - 1), go)).toBe(false);
    expect(go).toHaveBeenCalledOnce();
    // Long after, a new deploy's failure gets its own reload.
    expect(reloadToTarget("/app/groups/g1/planner", web(storage, 1_000 + GUARD_MS), go)).toBe(true);
    expect(go).toHaveBeenLastCalledWith("/app/groups/g1/planner");
  });

  it("never reloads on native, whose chunks ship inside the app", () => {
    const storage = memoryStorage();
    const go = vi.fn();
    expect(reloadToTarget("/app/groups/g1/providers", { build: "native", storage, now: 1_000 }, go)).toBe(
      false,
    );
    expect(go).not.toHaveBeenCalled();
    expect(storage.map.size).toBe(0);
  });

  it("doesn't reload when session storage can't hold the guard", () => {
    const go = vi.fn();
    const throwing = {
      getItem: () => null,
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => undefined,
    };
    expect(reloadToTarget("/app", { build: "web", storage: throwing, now: 1 }, go)).toBe(false);
    expect(reloadToTarget("/app", { build: "web", storage: null, now: 1 }, go)).toBe(false);
    expect(go).not.toHaveBeenCalled();
  });
});

describe("handOff and takeHandOff", () => {
  it("hands the pending target to the reload of the same page, once", () => {
    const storage = memoryStorage();
    expect(handOff("/app/groups/g1/providers", "/app/groups/g1", web(storage, 5_000))).toBe(true);
    expect(takeHandOff("/app/groups/g1", "reload", web(storage, 5_200))).toBe("/app/groups/g1/providers");
    expect(storage.map.has(HAND_OFF_KEY)).toBe(false);
    // Within the guard a second failing navigation hands nothing off.
    expect(handOff("/app/groups/g1/providers", "/app/groups/g1/providers", web(storage, 6_000))).toBe(false);
    expect(handOff("/app/groups/g1/planner", "/app/groups/g1/providers", web(storage, 6_000))).toBe(false);
    expect(storage.map.has(HAND_OFF_KEY)).toBe(false);
  });

  it("ignores a hand-off that isn't this page's reload, or is stale", () => {
    for (const [here, type, at] of [
      ["/app/groups/g1", "navigate", 5_100],
      ["/app/elsewhere", "reload", 5_100],
      ["/app/groups/g1", "reload", 5_000 + GUARD_MS],
    ] as const) {
      const storage = memoryStorage();
      handOff("/app/groups/g1/providers", "/app/groups/g1", web(storage, 5_000));
      expect(takeHandOff(here, type, web(storage, at))).toBeNull();
      expect(storage.map.has(HAND_OFF_KEY)).toBe(false);
    }
  });

  it("does nothing on native", () => {
    const storage = memoryStorage();
    expect(handOff("/app/b", "/app/a", { build: "native", storage, now: 1 })).toBe(false);
    storage.setItem(HAND_OFF_KEY, JSON.stringify({ to: "/app/b", from: "/app/a", at: 1 }));
    expect(takeHandOff("/app/a", "reload", { build: "native", storage, now: 2 })).toBeNull();
  });
});

/** A window with a location, a session store and events, enough for `watchStaleChunks`. */
function fakeWindow(path: string, navigationType = "navigate") {
  const target = new EventTarget();
  const url = new URL(path, "https://caretook.test");
  const storage = memoryStorage();
  const win = Object.assign(target, {
    location: {
      get pathname() {
        return url.pathname;
      },
      get search() {
        return url.search;
      },
      get hash() {
        return url.hash;
      },
      get href() {
        return url.href;
      },
      assign: vi.fn(),
      replace: vi.fn(),
    },
    history: { replaceState: vi.fn() },
    sessionStorage: storage,
    performance: { getEntriesByType: () => [{ type: navigationType }] },
  });
  return {
    win: win as unknown as StaleChunkWindow & EventTarget,
    storage,
    location: win.location,
    history: win.history,
  };
}

type NavigateInstrument = (
  impl: () => Promise<unknown>,
  info: { to: string | number; currentUrl: string },
) => Promise<void>;

/** The `navigate` wrapper the instrumentation installs. */
function navigateOf(instrumentations: ReturnType<typeof watchStaleChunks>): NavigateInstrument {
  let navigate: NavigateInstrument | undefined;
  instrumentations[0]?.router?.({
    instrument: (i: { navigate?: NavigateInstrument }) => {
      navigate = i.navigate;
    },
  });
  if (!navigate) throw new Error("no navigate instrumentation");
  return navigate;
}

const preloadError = () => new Event("vite:preloadError", { cancelable: true });

describe("watchStaleChunks", () => {
  it("a failed chunk on navigation reloads to the target once; a second failure doesn't loop", () => {
    const { win, location } = fakeWindow("/app/groups/g1");
    const navigate = navigateOf(watchStaleChunks("web", win, () => 10_000));
    // The click's navigation stays pending: its chunk failed.
    void navigate(() => new Promise(() => undefined), {
      to: "/app/groups/g1/providers",
      currentUrl: "/app/groups/g1",
    });
    const first = preloadError();
    win.dispatchEvent(first);
    expect(location.assign).toHaveBeenCalledExactlyOnceWith("/app/groups/g1/providers");
    expect(first.defaultPrevented).toBe(true);
    const second = preloadError();
    win.dispatchEvent(second);
    expect(location.assign).toHaveBeenCalledOnce();
    expect(second.defaultPrevented).toBe(false);
  });

  it("resolves a relative target against the page it's on", () => {
    const { win, location } = fakeWindow("/app/groups/g1/timeline");
    const navigate = navigateOf(watchStaleChunks("web", win, () => 10_000));
    void navigate(() => new Promise(() => undefined), {
      to: "planner?view=week",
      currentUrl: "/app/groups/g1/timeline",
    });
    win.dispatchEvent(preloadError());
    expect(location.assign).toHaveBeenCalledWith("/app/groups/g1/planner?view=week");
  });

  it("hands React Router's reload of a failed route module to the target", () => {
    const failing = fakeWindow("/app/groups/g1");
    const navigate = navigateOf(watchStaleChunks("web", failing.win, () => 10_000));
    void navigate(() => new Promise(() => undefined), {
      to: "/app/groups/g1/providers",
      currentUrl: "/app/groups/g1",
    });
    // React Router calls location.reload(): the page goes away mid-navigation.
    failing.win.dispatchEvent(new Event("pagehide"));
    expect(failing.storage.map.has(RELOAD_KEY)).toBe(true);

    // The reload boots on the old URL and moves to the target before the router starts.
    const reloaded = fakeWindow("/app/groups/g1", "reload");
    for (const [key, value] of failing.storage.map) reloaded.storage.setItem(key, value);
    watchStaleChunks("web", reloaded.win, () => 10_300);
    expect(reloaded.history.replaceState).toHaveBeenCalledExactlyOnceWith(
      null,
      "",
      "/app/groups/g1/providers",
    );
    expect(reloaded.location.replace).not.toHaveBeenCalled();
    // Failing again within the guard hands nothing off.
    const again = navigateOf(watchStaleChunks("web", reloaded.win, () => 10_400));
    void again(() => new Promise(() => undefined), {
      to: "/app/groups/g1/planner",
      currentUrl: "/app/groups/g1/providers",
    });
    reloaded.win.dispatchEvent(new Event("pagehide"));
    expect(reloaded.storage.map.has(HAND_OFF_KEY)).toBe(false);
  });

  it("loads a handed-off target outside /app rather than moving in place", () => {
    const { win, storage, location, history } = fakeWindow("/", "reload");
    storage.setItem(HAND_OFF_KEY, JSON.stringify({ to: "/sign-in", from: "/", at: 10_000 }));
    watchStaleChunks("web", win, () => 10_100);
    expect(location.replace).toHaveBeenCalledWith("/sign-in");
    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it("hands nothing off once the navigation has finished", async () => {
    const { win, storage } = fakeWindow("/app/groups/g1");
    const navigate = navigateOf(watchStaleChunks("web", win, () => 10_000));
    await navigate(() => Promise.resolve(), { to: "/app/groups/g1/providers", currentUrl: "/app/groups/g1" });
    win.dispatchEvent(new Event("pagehide"));
    expect(storage.map.size).toBe(0);
  });

  it("the native target doesn't reload", () => {
    const { win, storage, location, history } = fakeWindow("/app/groups/g1", "reload");
    storage.setItem(
      HAND_OFF_KEY,
      JSON.stringify({ to: "/app/groups/g1/providers", from: "/app/groups/g1", at: 1 }),
    );
    expect(watchStaleChunks("native", win, () => 2)).toEqual([]);
    win.dispatchEvent(new Event("pagehide"));
    const event = preloadError();
    win.dispatchEvent(event);
    expect(location.assign).not.toHaveBeenCalled();
    expect(location.replace).not.toHaveBeenCalled();
    expect(history.replaceState).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(claimReload({ build: "native", storage, now: 3 })).toBe(false);
  });
});
