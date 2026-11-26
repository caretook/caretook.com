// The worker's cache work, against a `CacheStorage` passed in (tests pass a fake).
import { cacheName, OFFLINE_PATH, SHELL_PATH, staleCaches } from "./serviceWorkerRoutes";

/** The parts of `CacheStorage` the worker uses. */
export type Caches = Pick<CacheStorage, "open" | "keys" | "delete">;

/** How many precache fetches run at once (B-787). */
export const PRECACHE_CONCURRENCY = 8;
/** Tries per precached path, the first included, before the install fails. */
export const PRECACHE_TRIES = 4;
/** The wait before the second try; it doubles before each later one. */
export const PRECACHE_BACKOFF_MS = 250;

/** What `precache` fetches and waits with (tests pass fakes). */
export type PrecacheDeps = {
  fetchFn?: (request: Request) => Promise<Response>;
  sleep?: (ms: number) => Promise<void>;
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Install: fetch every precached path into this version's cache, at most
 * `PRECACHE_CONCURRENCY` at once (B-787). The shell is fetched past the HTTP
 * cache, so a new version never stores an old document. A path whose fetch
 * fails or answers anything but a 200 is tried again with a short backoff, so
 * one dropped request on a flaky network doesn't fail the install; only a whole
 * good answer is stored, as `addAll` did. A path still failing after
 * `PRECACHE_TRIES` fails the install, and the browser tries again later; the
 * old worker keeps serving meanwhile, so a worker without its shell, the
 * offline page or any asset never takes over.
 */
export async function precache(
  caches: Caches,
  version: string,
  paths: readonly string[],
  origin: string,
  { fetchFn = fetch, sleep = wait }: PrecacheDeps = {},
) {
  const cache = await caches.open(cacheName(version));
  const requestOf = (path: string) =>
    new Request(
      new URL(path, origin),
      path === SHELL_PATH ? { cache: "reload", credentials: "same-origin" } : undefined,
    );

  const fetchWhole = async (path: string) => {
    for (let attempt = 1; ; attempt++) {
      const request = requestOf(path);
      let failure: unknown;
      try {
        const response = await fetchFn(request);
        if (response.status === 200) return { request, response };
        failure = new TypeError(`Precache of ${path} answered ${response.status}`);
      } catch (error) {
        failure = error;
      }
      if (attempt >= PRECACHE_TRIES) throw failure;
      await sleep(PRECACHE_BACKOFF_MS * 2 ** (attempt - 1));
    }
  };

  let next = 0;
  let failed = false;
  const runner = async () => {
    while (!failed && next < paths.length) {
      const path = paths[next++]!;
      try {
        const { request, response } = await fetchWhole(path);
        await cache.put(request, response);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PRECACHE_CONCURRENCY, paths.length) }, runner));
}

/** Activate: delete earlier versions' caches. Returns the names it deleted. */
export async function deleteStaleCaches(caches: Caches, version: string) {
  const stale = staleCaches(await caches.keys(), version);
  await Promise.all(stale.map((name) => caches.delete(name)));
  return stale;
}

/** A cached answer from this version's cache, or `undefined`. */
export async function fromCache(caches: Caches, version: string, key: string) {
  const cache = await caches.open(cacheName(version));
  return cache.match(key);
}

/**
 * A kept asset (`keep` in `routeRequest`): fetched, and a whole good answer
 * (200, same-origin) stored in this version's cache under `key`, so the next
 * request for it, offline too, comes from the cache. Anything else (an error
 * page, a partial answer) is passed on and not stored; a failed fetch rejects
 * as the network would. The store finishes before it resolves.
 */
export async function fetchAndKeep(
  caches: Caches,
  version: string,
  key: string,
  request: Request,
  fetchFn: (request: Request) => Promise<Response> = fetch,
) {
  const response = await fetchFn(request);
  if (response.status !== 200 || response.type !== "basic") return response;
  const cache = await caches.open(cacheName(version));
  await cache.put(key, response.clone());
  return response;
}

/**
 * A page load outside /app (`offline` in `routeRequest`, B-788): the network's
 * answer whatever it is (an error page too), and the precached offline page
 * only when the fetch itself fails. Nothing is stored. With no offline page in
 * the cache, it rejects as the network did.
 */
export async function networkOrOffline(
  caches: Caches,
  version: string,
  request: Request,
  fetchFn: (request: Request) => Promise<Response> = fetch,
) {
  try {
    return await fetchFn(request);
  } catch (error) {
    const page = await fromCache(caches, version, OFFLINE_PATH);
    if (page) return page;
    throw error;
  }
}
