// A tab left open across a deploy (B-735). A deploy replaces the build's hashed
// chunks, and the old ones are gone from the server; once this tab's service
// worker no longer has them either (a newer worker took over and deleted the
// old cache), a chunk the old page hasn't loaded yet fails to load.
//
// Two ways that shows:
// - a route module: React Router's `loadRouteModule` catches the failed import
//   and calls `location.reload()`, on the page the tab is on, not the one
//   clicked, and leaves the navigation pending forever. The click looks dead.
//   `pagehide` hands the pending target to the reloaded page, which moves to it
//   before React Router starts (`takeHandOff`), so the reload lands where the
//   person was going.
// - a chunk loaded through Vite's preload helper (a sheet, the sync client):
//   `vite:preloadError`, which reloads to the target here.
//
// One reload per GUARD_MS (a session-storage marker), so a build that is
// really broken can't reload in a loop, and never on native, whose chunks ship
// inside the app.
import type { ClientInstrumentation } from "react-router";

/** The marker: when this tab last reloaded for a failed chunk. */
export const RELOAD_KEY = "caretook:chunk-reload";
/** The target handed from the failing page to the reloaded one. */
export const HAND_OFF_KEY = "caretook:chunk-reload-target";
/** No second reload within this long of the last one. */
export const GUARD_MS = 30_000;

export type Build = "web" | "native";
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type ReloadEnv = {
  build: Build;
  /** `sessionStorage`, or null where it can't be used (then no reload: nothing could guard it). */
  storage: Store | null;
  now: number;
};

/** Takes the one reload the guard allows: false on native, without storage, or within GUARD_MS of the last. */
export function claimReload({ build, storage, now }: ReloadEnv): boolean {
  if (build === "native" || !storage) return false;
  try {
    const last = Number(storage.getItem(RELOAD_KEY));
    if (Number.isFinite(last) && last > 0 && now - last < GUARD_MS) return false;
    storage.setItem(RELOAD_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

/** A failed chunk load: reload to `target` once (see `claimReload`). True when it reloads. */
export function reloadToTarget(target: string, env: ReloadEnv, go: (url: string) => void): boolean {
  if (!claimReload(env)) return false;
  go(target);
  return true;
}

/**
 * The page is going away mid-navigation (React Router's reload after a failed
 * route module): leave `target` for the reloaded page, if the guard allows a reload.
 */
export function handOff(target: string, from: string, env: ReloadEnv): boolean {
  if (target === from || !claimReload(env)) return false;
  try {
    env.storage?.setItem(HAND_OFF_KEY, JSON.stringify({ to: target, from, at: env.now }));
    return true;
  } catch {
    return false;
  }
}

/**
 * At boot: the target a failing page handed off, when this load is that page's
 * reload (same URL, within GUARD_MS); null otherwise. Always clears it.
 */
export function takeHandOff(here: string, navigationType: string | undefined, env: ReloadEnv): string | null {
  if (env.build === "native" || !env.storage) return null;
  try {
    const raw = env.storage.getItem(HAND_OFF_KEY);
    if (raw === null) return null;
    env.storage.removeItem(HAND_OFF_KEY);
    const { to, from, at } = JSON.parse(raw) as { to?: unknown; from?: unknown; at?: unknown };
    if (navigationType !== "reload" || from !== here || typeof to !== "string") return null;
    if (typeof at !== "number" || env.now - at < 0 || env.now - at >= GUARD_MS) return null;
    return to;
  } catch {
    return null;
  }
}

/** The parts of `window` `watchStaleChunks` uses (a parameter, so tests pass a fake). */
export type StaleChunkWindow = Pick<Window, "addEventListener"> & {
  location: Pick<Location, "pathname" | "search" | "hash" | "href" | "assign" | "replace">;
  history: Pick<History, "replaceState">;
  sessionStorage: Store;
  performance: Pick<Performance, "getEntriesByType">;
};

const isAppPath = (path: string) => path === "/app" || /^\/app[/?#]/.test(path);

const pathOf = (url: Pick<Location, "pathname" | "search" | "hash">) =>
  `${url.pathname}${url.search}${url.hash}`;

/**
 * Wires it up, before React Router starts: moves a handed-off reload to its
 * target, listens for `vite:preloadError` and `pagehide`, and returns the
 * router instrumentation that tracks the pending navigation's target. On
 * native it does nothing.
 */
export function watchStaleChunks(build: Build, win: StaleChunkWindow, now = () => Date.now()) {
  const instrumentations: ClientInstrumentation[] = [];
  if (build === "native") return instrumentations;
  const env = (): ReloadEnv => {
    let storage: Store | null = null;
    try {
      storage = win.sessionStorage;
    } catch {
      // Blocked storage: no guard, so no reload.
    }
    return { build, storage, now: now() };
  };

  let navigationType: string | undefined;
  try {
    const [entry] = win.performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    navigationType = entry?.type;
  } catch {
    // No timing entry: not a reload we can recognise.
  }
  const here = pathOf(win.location);
  const handedOff = takeHandOff(here, navigationType, env());
  // An /app page is client-only (the server sends the same empty shell for
  // every /app URL, as the service worker does), so the router can start on
  // the target in place. Anything else could mismatch the server's markup: load it.
  if (handedOff && isAppPath(here) && isAppPath(handedOff)) win.history.replaceState(null, "", handedOff);
  else if (handedOff) win.location.replace(handedOff);

  let pending: string | null = null;
  instrumentations.push({
    router(router) {
      router.instrument({
        async navigate(impl, { to, currentUrl }) {
          // History steps (`navigate(-1)`) have no target to reload to.
          const target =
            typeof to === "string" ? pathOf(new URL(to, new URL(currentUrl, win.location.href))) : null;
          pending = target;
          try {
            await impl();
          } finally {
            // A newer navigation that interrupted this one keeps its own target.
            if (pending === target) pending = null;
          }
        },
      });
    },
  });

  win.addEventListener("pagehide", () => {
    if (pending) handOff(pending, pathOf(win.location), env());
  });
  win.addEventListener("vite:preloadError", (event) => {
    const target = pending ?? pathOf(win.location);
    // preventDefault keeps Vite from rethrowing while the page reloads.
    if (reloadToTarget(target, env(), (url) => win.location.assign(url))) event.preventDefault();
  });
  return instrumentations;
}
