// The worker's cache work, against a `CacheStorage` passed in (tests pass a fake).
import { cacheName, SHELL_PATH, staleCaches } from "./serviceWorkerRoutes";

/** The parts of `CacheStorage` the worker uses. */
export type Caches = Pick<CacheStorage, "open" | "keys" | "delete">;

/**
 * Install: fetch every precached path into this version's cache. The shell is
 * fetched past the HTTP cache, so a new version never stores an old document.
 * Any failed fetch fails the install (`addAll` rejects), and the browser tries
 * again later; the old worker keeps serving meanwhile.
 */
export async function precache(caches: Caches, version: string, paths: readonly string[], origin: string) {
  const cache = await caches.open(cacheName(version));
  await cache.addAll(
    paths.map((path) =>
      path === SHELL_PATH
        ? new Request(new URL(path, origin), { cache: "reload", credentials: "same-origin" })
        : path,
    ),
  );
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
