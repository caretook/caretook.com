// The web build's initial chunks, for the bundle budget (budget.mjs).
//
// Reads apps/web/build/web/client: React Router's route manifest
// (assets/manifest-*.js: each route's module and static imports), and
// .vite/chunk-modules.json (the source modules of each chunk, written by
// vite.config.ts's chunkModules, beside Vite's own manifest.json).
//
// Groups: `entry` (the client entry), `root` (entry + the root route) and `app`
// (root + the /app layout and its ancestors): what a first visit to /app loads.

import { readFileSync, readdirSync } from "node:fs";
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
 * The service worker's precache list (scripts/build/service-worker.mjs): the
 * shell first, then every JS and CSS file in Vite's client manifest, and the
 * route manifest (React Router writes it outside Vite's). WASM stays out: the
 * four SQLite builds are 7 MB and a device loads one, which PowerSync's
 * workers fetch and the browser's HTTP cache keeps (immutable assets), as it
 * does the workers' own files, which Vite's manifest doesn't list.
 */
export function precacheList({ viteManifest, routeManifestFile, shell = "/app" }) {
  const files = new Set();
  for (const chunk of Object.values(viteManifest)) {
    for (const f of [chunk.file, ...(chunk.css ?? []), ...(chunk.assets ?? [])]) files.add(f);
  }
  files.add(routeManifestFile);
  const assets = [...files].filter((f) => /\.(js|css)$/.test(f)).map((f) => `/${file(f)}`);
  return [shell, ...assets.sort()];
}

/** The precache list of a build's client directory. */
export function readPrecacheList(clientDir) {
  const routeManifestFile = readdirSync(join(clientDir, "assets")).find((f) => /^manifest-.*\.js$/.test(f));
  if (!routeManifestFile) throw new Error(`no route manifest in ${clientDir}/assets: build the web target first`);
  const viteManifest = JSON.parse(readFileSync(join(clientDir, ".vite/manifest.json"), "utf8"));
  return precacheList({ viteManifest, routeManifestFile: `assets/${routeManifestFile}` });
}
