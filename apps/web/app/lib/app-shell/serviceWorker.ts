// The service worker (B-144): written to the web client build as /sw.js by
// scripts/build/service-worker.mjs, which bundles this file and replaces
// __PRECACHE__ (the build's precache list, the shell first) and __SW_VERSION__.
// The web target only: the native app ships its files, and the dev server
// never registers a worker (entry.client.tsx).
//
// Updates: a new worker installs and waits (no skipWaiting on install), so a
// tab on the old version keeps its old chunks; the page shows "A new version
// is ready" and its Reload posts SKIP_WAITING. Activate deletes the other
// versions' caches and takes over open pages.
import { deleteStaleCaches, fromCache, precache } from "./serviceWorkerCaches";
import { routeRequest, SHELL_PATH, SKIP_WAITING } from "./serviceWorkerRoutes";

declare const __PRECACHE__: string[];
declare const __SW_VERSION__: string;

// The few service-worker types used here (apps/web's TypeScript has the DOM
// library, not the webworker one, and the two don't mix in one program).
type ExtendableEvent = Event & { waitUntil(work: Promise<unknown>): void };
type FetchEvent = ExtendableEvent & { request: Request; respondWith(response: Promise<Response>): void };
type MessageEvent = ExtendableEvent & { data: unknown };
type WorkerScope = {
  location: Location;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(type: "install" | "activate", listener: (event: ExtendableEvent) => void): void;
  addEventListener(type: "fetch", listener: (event: FetchEvent) => void): void;
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
};

const worker = self as unknown as WorkerScope;
const version = __SW_VERSION__;
const precached = new Set(__PRECACHE__);

worker.addEventListener("install", (event) => {
  event.waitUntil(precache(caches, version, __PRECACHE__, worker.location.origin));
});

worker.addEventListener("activate", (event) => {
  event.waitUntil(deleteStaleCaches(caches, version).then(() => worker.clients.claim()));
});

worker.addEventListener("message", (event) => {
  if (event.data === SKIP_WAITING) event.waitUntil(worker.skipWaiting());
});

worker.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const route = routeRequest(
    { url, mode: request.mode, method: request.method },
    worker.location.origin,
    precached,
  );
  // The network: not answering leaves the request to the browser, as if there were no worker.
  if (route === "network") return;
  const key = route === "shell" ? SHELL_PATH : url.pathname;
  event.respondWith(fromCache(caches, version, key).then((cached) => cached ?? fetch(request)));
});
