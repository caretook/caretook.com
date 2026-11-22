import type { RouteConfigEntry } from "@react-router/dev/routes";

import { describe, expect, it } from "vitest";
import { adminRoutes } from "./routes/admin/routes";
import { googleCalendarRoutes } from "./routes/api/google/routes";
import { connectorRoutes } from "./routes/connectors/routes";
import { devUiRoutes, notificationRoutes } from "./routes/dev/routes";
import { marketingRoutes } from "./routes/marketing/routes";
import { composeRoutes } from "./routes";

// Rules the route config keeps, not a list of its routes: adding a route
// changes nothing here unless it breaks one.

type Flat = { path: string; file: string; id: string | undefined; index: boolean; leaf: boolean };

const flatten = (routes: RouteConfigEntry[], parent = ""): Flat[] =>
  routes.flatMap((r) => {
    const path = r.path ? `${parent}/${r.path}` : parent;
    return [
      { path: path || "/", file: r.file, id: r.id, index: !!r.index, leaf: !r.children?.length },
      ...flatten(r.children ?? [], path),
    ];
  });

const key = (r: Flat) => `${r.path}|${r.file}|${r.id ?? ""}${r.index ? "|index" : ""}`;

const WEB = flatten(composeRoutes(false));
const NATIVE = flatten(composeRoutes(true));
const TARGETS = { web: WEB, native: NATIVE };

// React Router's id for a route without one: its file, less the extension.
const routeId = (r: Flat) => r.id ?? r.file.replace(/\.[^./]+$/, "");

// The web-only areas, from their own route lists, and the server-only paths.
const WEB_ONLY_FILES = new Set(
  flatten([
    ...marketingRoutes,
    ...adminRoutes,
    ...connectorRoutes,
    ...notificationRoutes,
    ...googleCalendarRoutes,
    ...devUiRoutes,
  ]).map((r) => r.file),
);
const WEB_ONLY_PATH = /^\/(api|rpc|admin|dev|mcp|connect|\.well-known)(\/|$)/;

describe.each(Object.entries(TARGETS))("the %s route config", (_, routes) => {
  it("has each route id once", () => {
    const ids = routes.map(routeId);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it("answers each path with one route", () => {
    const paths = routes.filter((r) => r.leaf).map((r) => r.path);
    expect(paths.filter((p, i) => paths.indexOf(p) !== i)).toEqual([]);
  });
});

describe("the native route config", () => {
  it("has no API, RPC, admin, dev or connector path", () => {
    expect(NATIVE.map((r) => r.path).filter((p) => WEB_ONLY_PATH.test(p))).toEqual([]);
  });

  it("has no route from a web-only area (marketing, admin, connectors, API, dev)", () => {
    expect(
      NATIVE.map((r) => r.file).filter((f) => WEB_ONLY_FILES.has(f) || f.startsWith("routes/web/")),
    ).toEqual([]);
  });

  it("has every route in the web config too, but its own index, whose path web answers", () => {
    const web = new Set(WEB.map(key));
    const webPaths = new Set(WEB.filter((r) => r.leaf).map((r) => r.path));
    const own = NATIVE.filter((r) => r.file === "routes/native-index.tsx");
    expect(own.map((r) => r.path)).toEqual(["/"]);
    expect(own.every((r) => webPaths.has(r.path))).toBe(true);
    expect(NATIVE.filter((r) => !own.includes(r) && !web.has(key(r))).map(key)).toEqual([]);
  });
});
