// The service worker's rules (app-speed PRD, B-144), pure so they're unit-tested
// without a browser. The worker itself (serviceWorker.ts) only wires them to events.
//
// Its scope is `/`, but it answers only two kinds of request:
// - an `/app` or `/app/*` page load gets the shell: the server's own `/app`
//   document, fetched at install with its headers. It's a client-only page
//   (every /app route has only a clientLoader, so the server renders root's
//   empty HydrateFallback), and the client router boots on whatever URL it's at.
// - a precached asset (the build's hashed JS and CSS, listed at build) comes
//   from the cache.
// Everything else goes to the network untouched: the marketing pages,
// /sign-in, /api/*, /rpc/*, PowerSync (another origin), the files PowerSync's
// workers load, and any non-GET request.

/** Where the shell is fetched from at install, and its key in the cache. */
export const SHELL_PATH = "/app";

/** Every cache this worker makes starts with this; others' caches are never touched. */
export const CACHE_PREFIX = "caretook-";

export type Route = "shell" | "cache" | "network";

export type RoutedRequest = {
  url: URL;
  /** `Request.mode`: "navigate" for a page load. */
  mode: string;
  method?: string;
};

/**
 * How the worker answers a request. `origin` is the worker's own origin and
 * `precached` the precache list's paths (`/assets/…`).
 */
export function routeRequest(
  { url, mode, method = "GET" }: RoutedRequest,
  origin: string,
  precached: ReadonlySet<string>,
): Route {
  if (method !== "GET" || url.origin !== origin) return "network";
  if (mode === "navigate") return isAppPath(url.pathname) ? "shell" : "network";
  return precached.has(url.pathname) ? "cache" : "network";
}

const isAppPath = (pathname: string) => pathname === SHELL_PATH || pathname.startsWith(`${SHELL_PATH}/`);

/** This build's cache. */
export const cacheName = (version: string) => `${CACHE_PREFIX}${version}`;

/** The caches to delete on activate: this worker's earlier versions, never this one or another app's. */
export const staleCaches = (names: readonly string[], version: string) =>
  names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== cacheName(version));

/** The message a page posts to a waiting worker to make it take over (the update notice's Reload). */
export const SKIP_WAITING = "skip-waiting";
