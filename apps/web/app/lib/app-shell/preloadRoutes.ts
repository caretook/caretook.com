// The chunks of the screen a sign-in lands on, fetched at once (B-764).
//
// React Router loads a route on a client navigation with a bare `import()` of
// its module, so the browser finds each chunk's own imports only once that
// chunk has arrived: the /app frame and the timeline came down in 7 to 10
// rounds after a sign-in, one after another. The route manifest already lists
// every chunk a route needs (`imports`), so a `<link rel="modulepreload">` for
// each one asks for them all together, while the sign-in's own redirect, the
// session check and the first sync run. The local database's code (a lazy
// chunk `openSync` loads only after the session check) starts first, beside
// them. Nothing else changes: the router still loads and runs the routes as
// before, from the browser's module cache.

import type { RouteObject } from "react-router";

import { matchRoutes } from "react-router";
import { preloadSync } from "../sync";
import { appUrls } from "./appUrls";
import { GROUP_LIST_PARAM } from "./urls";

/** The parts of a route manifest entry (`window.__reactRouterManifest.routes`) read here. */
export type ManifestRoute = {
  id: string;
  parentId?: string;
  path?: string;
  index?: boolean;
  caseSensitive?: boolean;
  module: string;
  imports?: string[];
  clientLoaderModule?: string;
  clientMiddlewareModule?: string;
};

export type RouteManifest = { routes: Record<string, ManifestRoute> };

/** The manifest as a route tree, the way React Router builds its client routes. */
function routeTree(manifest: RouteManifest, parentId?: string): RouteObject[] {
  return Object.values(manifest.routes)
    .filter((route) => route.parentId === parentId)
    .map((route) =>
      route.index
        ? { id: route.id, path: route.path, index: true, caseSensitive: route.caseSensitive }
        : {
            id: route.id,
            path: route.path,
            caseSensitive: route.caseSensitive,
            children: routeTree(manifest, route.id),
          },
    );
}

/** Any group id: the timeline's routes are the same for every group. */
const SOME_GROUP = "00000000-0000-0000-0000-000000000000";

/**
 * The paths a sign-in to `redirectTo` will render: that one, and for /app's
 * home, which sends a member on to their group (`resolveHomeGroup`), a
 * group's timeline too. The group list (`?groups=1`) stays where it is.
 */
export function landingPaths(redirectTo: string): string[] {
  const url = new URL(redirectTo, "https://caretook.invalid");
  const home = url.pathname.replace(/\/$/, "") === appUrls.home() && !url.searchParams.has(GROUP_LIST_PARAM);
  return home ? [url.pathname, appUrls.timeline(SOME_GROUP)] : [url.pathname];
}

/**
 * Every chunk the routes matching `paths` load: each route's module, its
 * split loader and middleware, and their static imports, in order and once each.
 */
export function landingChunks(manifest: RouteManifest, paths: string[]): string[] {
  const tree = routeTree(manifest);
  const chunks = new Set<string>();
  for (const path of paths) {
    for (const { route } of matchRoutes(tree, path) ?? []) {
      const entry = route.id ? manifest.routes[route.id] : undefined;
      if (!entry) continue;
      for (const chunk of [
        entry.clientMiddlewareModule,
        entry.clientLoaderModule,
        entry.module,
        ...(entry.imports ?? []),
      ])
        if (chunk) chunks.add(chunk);
    }
  }
  return [...chunks];
}

/** Adds a modulepreload link for each chunk not already linked. Returns how many it added. */
export function preloadModules(chunks: string[], doc: Document): number {
  const linked = new Set(
    [...doc.head.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')].map((link) =>
      link.getAttribute("href"),
    ),
  );
  let added = 0;
  for (const chunk of chunks) {
    if (linked.has(chunk)) continue;
    const link = doc.createElement("link");
    link.rel = "modulepreload";
    link.href = chunk;
    doc.head.append(link);
    linked.add(chunk);
    added += 1;
  }
  return added;
}

/**
 * After a sign-in, before its redirect: fetch the local database's code, then
 * the chunks of the screen it lands on, together. Without a route manifest
 * (none outside the browser) it fetches no route chunks.
 */
export function preloadLanding(redirectTo: string): void {
  if (typeof window === "undefined") return;
  // First, so its download isn't queued behind the routes' (openSync waits on it).
  preloadSync();
  const manifest = (window as { __reactRouterManifest?: RouteManifest }).__reactRouterManifest;
  if (!manifest?.routes) return;
  try {
    preloadModules(landingChunks(manifest, landingPaths(redirectTo)), document);
  } catch (error) {
    // A preload is only a head start: the router loads the routes either way.
    console.warn("Couldn't preload the landing screen", error);
  }
}
