#!/usr/bin/env node
// The web build's service worker (B-144): run by react-router.config.ts's
// `buildEnd` after every web build (local, check and Vercel builds), never for
// native. It bundles apps/web/app/lib/app-shell/serviceWorker.ts into
// <client dir>/sw.js, with the precache list (manifest.mjs) and a build version
// baked in.
//
//   node scripts/build/service-worker.mjs [client dir]   (default apps/web/build/web/client)

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readPrecacheList } from "./manifest.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, "../../apps/web");
const workerDir = join(web, "app/lib/app-shell");
/** The worker's modules: the entry, and what it imports. */
const WORKER_SOURCES = ["serviceWorker.ts", "serviceWorkerCaches.ts", "serviceWorkerRoutes.ts"];

/**
 * The build version: a hash of the precache list (its files are content-hashed)
 * and the worker's own source, so an unchanged build keeps its version (and no
 * update notice), and any change to what it serves or how makes a new one.
 */
export function serviceWorkerVersion(list, sources) {
  const hash = createHash("sha256");
  for (const part of [...list, ...sources]) hash.update(part).update("\0");
  return hash.digest("hex").slice(0, 16);
}

export async function writeServiceWorker(clientDir) {
  const list = readPrecacheList(clientDir);
  const sources = WORKER_SOURCES.map((f) => readFileSync(join(workerDir, f), "utf8"));
  const version = serviceWorkerVersion(list, sources);
  // Vite is apps/web's dependency, not the repo root's.
  const vite = await import(pathToFileURL(createRequire(join(web, "package.json")).resolve("vite")).href);
  await vite.build({
    configFile: false,
    root: web,
    logLevel: "warn",
    publicDir: false,
    define: { __PRECACHE__: JSON.stringify(list), __SW_VERSION__: JSON.stringify(version) },
    build: {
      outDir: clientDir,
      emptyOutDir: false,
      copyPublicDir: false,
      manifest: false,
      minify: true,
      lib: { entry: join(workerDir, WORKER_SOURCES[0]), formats: ["iife"], name: "caretookWorker", fileName: () => "sw.js" },
    },
  });
  return { version, count: list.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const clientDir = resolve(process.argv[2] ?? join(web, "build/web/client"));
  const { version, count } = await writeServiceWorker(clientDir);
  console.log(`sw.js: version ${version}, ${count} precached`);
}
