// The back/forward cache and the local database (B-38, B-41).
//
// Leaving a page by a full load (a typed URL, a reload, a link to another
// document) can keep the old page frozen in the browser's back/forward cache
// instead of unloading it. PowerSync's shared workers only let go of a page
// when the page's "tab close" Web Locks are released, which unloading does and
// freezing doesn't. So the workers keep waiting on the frozen page (its
// database connection, often mid-transaction), and the next page's database
// never opens: a blank page, with no error. A Vite dev server hides it: its
// open websocket keeps pages out of the cache.
//
// So this page lets go of PowerSync's locks itself when it goes into the
// cache, as unloading would, and reloads if it's restored from the cache,
// since the workers have dropped its connections by then. On the web, an
// /app reload works offline too: the service worker serves the shell
// (lib/app-shell/serviceWorker.ts; B-144). Before it, Back offline showed the browser's
// error page.

/** The locks PowerSync holds in a page for as long as the page lives. */
const PAGE_LIFETIME_LOCK = /^(tab-close-signal-|shared-connection-)/;

type LockCallback = (lock: Lock | null) => unknown;

/** The parts of `window` this needs (a parameter, so tests can pass a fake). */
export type PageLifecycle = {
  addEventListener(type: "pagehide" | "pageshow", listener: (event: PageTransitionEvent) => void): void;
  location: { reload(): void };
};

const installed = new WeakSet<LockManager>();

/**
 * Wraps `locks.request` so the page's PowerSync lifetime locks can be released
 * early, releases them on a `pagehide` into the back/forward cache, and reloads
 * on a `pageshow` out of it. Call it once, before PowerSync opens; later calls
 * do nothing.
 */
export const releaseSyncLocksWhenCached = (locks: LockManager, page: PageLifecycle) => {
  if (installed.has(locks)) return;
  installed.add(locks);

  const held = new Set<() => void>();
  const request = locks.request.bind(locks) as (
    name: string,
    options: LockOptions,
    callback: LockCallback,
  ) => Promise<unknown>;

  const wrapped = (
    name: string,
    optionsOrCallback: LockOptions | LockCallback,
    maybeCallback?: LockCallback,
  ) => {
    const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;
    const options = typeof optionsOrCallback === "function" ? {} : optionsOrCallback;
    if (!callback) throw new TypeError("navigator.locks.request needs a callback");
    if (!PAGE_LIFETIME_LOCK.test(name)) return request(name, options, callback);
    return request(name, options, (lock) => {
      if (!lock) return callback(lock);
      // Held until PowerSync's callback settles, or until the page is cached.
      return new Promise((resolve, reject) => {
        const release = () => resolve(undefined);
        held.add(release);
        Promise.resolve()
          .then(() => callback(lock))
          .then(resolve, reject)
          .finally(() => held.delete(release));
      });
    });
  };
  Object.defineProperty(locks, "request", { value: wrapped, configurable: true, writable: true });

  page.addEventListener("pagehide", (event) => {
    if (!event.persisted) return; // Unloading releases them anyway.
    for (const release of [...held]) release();
  });
  page.addEventListener("pageshow", (event) => {
    if (event.persisted) page.location.reload();
  });
};
