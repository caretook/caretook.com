// The web build's initial chunks, for the bundle budget (budget.mjs).
//
// Reads apps/web/build/web/client: React Router's route manifest
// (assets/manifest-*.js: each route's module and static imports), and
// .vite/chunk-modules.json (the source modules of each chunk, written by
// vite.config.ts's chunkModules, beside Vite's own manifest.json).
//
// Groups: `entry` (the client entry), `root` (entry + the root route) and `app`
// (root + the /app layout and its ancestors): what a first visit to /app loads.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

/** The route manifest's `window.__reactRouterManifest = {…}` assignment, evaluated. */
export function parseRouteManifest(source) {
  const window = {};
  new Function("window", source)(window);
  return window.__reactRouterManifest;
}

const file = (url) => url.replace(/^\//, "");

/** A route's own chunk and its static imports. */
function routeChunks(route) {
  return [route.module, ...route.imports].map(file);
}

const unique = (list) => [...new Set(list)];

/**
 * The listing from the parsed pieces; `gzipOf(chunk)` gives a chunk's gzip size.
 * `appRoute` is the id of the /app layout.
 */
export function buildListing({ routeManifest, chunkModules, gzipOf, appRoute = "app" }) {
  const entry = routeManifest.entry;
  const entryChunks = [entry.module, ...entry.imports].map(file);
  const rootChunks = unique([...entryChunks, ...routeChunks(routeManifest.routes.root)]);
  const appChain = [];
  for (let r = routeManifest.routes[appRoute]; r; r = routeManifest.routes[r.parentId]) appChain.push(r);
  const appChunks = unique([...rootChunks, ...appChain.flatMap(routeChunks)]);

  const groups = { entry: entryChunks, root: rootChunks, app: appChunks };
  const chunks = {};
  for (const chunk of appChunks) {
    // A chunk with no module list could hide a forbidden module: refuse it.
    if (!(chunk in chunkModules)) throw new Error(`${chunk} has no module list in .vite/chunk-modules.json`);
    chunks[chunk] = { gzip: gzipOf(chunk), modules: chunkModules[chunk] };
  }
  return { groups, chunks };
}

/** Reads the listing from a build's client directory (apps/web/build/web/client). */
export function readListing(clientDir) {
  const manifestFile = readdirSync(join(clientDir, "assets")).find((f) => /^manifest-.*\.js$/.test(f));
  if (!manifestFile) throw new Error(`no route manifest in ${clientDir}/assets: build the web target first`);
  const read = (p) => readFileSync(join(clientDir, p), "utf8");
  return buildListing({
    routeManifest: parseRouteManifest(read(`assets/${manifestFile}`)),
    chunkModules: JSON.parse(read(".vite/chunk-modules.json")),
    gzipOf: (chunk) => gzipSync(readFileSync(join(clientDir, chunk))).length,
  });
}

/**
 * The SQLite build the local database loads at every start: PowerSync's
 * default VFS (IDBBatchAtomicVFS) runs the async build, unencrypted (`mc-` is
 * the encrypted one). Without it offline the database can't open, so the app
 * can't show anything (B-777).
 */
export const SQLITE_WASM = /^wa-sqlite-async-[\w-]+\.wasm$/;

/** The offline page, copied from apps/web/public/ (OFFLINE_PATH in serviceWorkerRoutes.ts). */
export const OFFLINE_PAGE = "/offline.html";

/**
 * The service worker's precache list (scripts/build/service-worker.mjs): the
 * shell first, the offline page (public/offline.html, B-788: what a failed
 * page load outside /app gets), then every JS, CSS and font (woff2) file the build wrote to
 * `assets/` (`files`, their names), and the SQLite WASM the device loads
 * (`SQLITE_WASM`, 2.2 MB). The fonts (app/fonts/, B-415) are in so the
 * offline shell keeps its typeface, and their hashes version the worker.
 *
 * The directory, not Vite's client manifest (B-777): PowerSync's database
 * worker is its own bundle, whose chunks (the VFS it opens, the SQLite glue)
 * the manifest doesn't list, and it fetches them and the WASM through the
 * service worker at every start. Left out, offline they could come only from
 * the HTTP cache, which phones evict, and then the database can't open. The
 * other three SQLite builds (5 MB) stay out; the worker keeps any other
 * `/assets/` file on first use (`keep` in serviceWorkerRoutes.ts).
 */
export function precacheList({ files, shell = "/app", offline = OFFLINE_PAGE }) {
  const precached = (f) => /\.(js|css|woff2)$/.test(f) || SQLITE_WASM.test(f);
  const assets = files.filter(precached).map((f) => `/assets/${f}`);
  return [shell, offline, ...[...new Set(assets)].sort()];
}

/** The precache list of a build's client directory. */
export function readPrecacheList(clientDir) {
  const files = readdirSync(join(clientDir, "assets"));
  if (!files.some((f) => /^manifest-.*\.js$/.test(f)))
    throw new Error(`no route manifest in ${clientDir}/assets: build the web target first`);
  // A renamed SQLite build would quietly bring the blank offline start back.
  if (!files.some((f) => SQLITE_WASM.test(f)))
    throw new Error(`no SQLite WASM matching ${SQLITE_WASM} in ${clientDir}/assets: update SQLITE_WASM`);
  // Without it the install's precache would fail on every device.
  if (!existsSync(join(clientDir, OFFLINE_PAGE))) throw new Error(`no ${OFFLINE_PAGE} in ${clientDir}`);
  return precacheList({ files });
}
