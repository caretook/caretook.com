import { describe, expect, it } from "vitest";

import { cacheName, routeRequest, staleCaches } from "./serviceWorkerRoutes";

const ORIGIN = "https://caretook.com";
const precached = new Set(["/app", "/assets/entry.client-abc.js", "/assets/app-def.css"]);
const route = (path: string, mode = "cors", method = "GET") =>
  routeRequest({ url: new URL(path, ORIGIN), mode, method }, ORIGIN, precached);

describe("routeRequest", () => {
  it("answers every /app page load with the shell", () => {
    expect(route("/app", "navigate")).toBe("shell");
    expect(route("/app/", "navigate")).toBe("shell");
    expect(route("/app/groups/g1/timeline", "navigate")).toBe("shell");
    expect(route("/app/groups/g1/providers/p1?sheet=1", "navigate")).toBe("shell");
    expect(route("/app/settings/units", "navigate")).toBe("shell");
  });

  it("leaves other page loads to the network: marketing, sign-in, account links, a lookalike path", () => {
    for (const path of [
      "/",
      "/features/",
      "/sign-in",
      "/sign-out",
      "/invite/t1",
      "/join/c1",
      "/admin",
      "/apple",
    ])
      expect(route(path, "navigate")).toBe("network");
  });

  it("serves precached assets from the cache", () => {
    expect(route("/assets/entry.client-abc.js", "cors")).toBe("cache");
    expect(route("/assets/app-def.css", "no-cors")).toBe("cache");
  });

  it("leaves assets it didn't precache to the network (PowerSync's worker files, WASM)", () => {
    expect(route("/assets/wa-sqlite-xyz.wasm", "same-origin")).toBe("network");
    expect(route("/assets/WASQLiteDB.worker-xyz.js", "same-origin")).toBe("network");
  });

  it("never answers the API, sync or another origin", () => {
    expect(route("/api/auth/get-session")).toBe("network");
    expect(route("/rpc/timeline/list", "cors", "POST")).toBe("network");
    expect(route("/app.data")).toBe("network");
    expect(
      routeRequest(
        { url: new URL("https://sync.caretook.com/sync/stream"), mode: "cors" },
        ORIGIN,
        precached,
      ),
    ).toBe("network");
    // A precached path on another origin is still the network.
    expect(
      routeRequest(
        { url: new URL("https://cdn.example.com/assets/app-def.css"), mode: "cors" },
        ORIGIN,
        precached,
      ),
    ).toBe("network");
  });

  it("never answers a request that isn't a GET, even to /app", () => {
    expect(route("/app/groups/g1/timeline", "navigate", "POST")).toBe("network");
    expect(route("/assets/app-def.css", "cors", "HEAD")).toBe("network");
  });
});

describe("cache names", () => {
  it("names a version's cache", () => {
    expect(cacheName("v2")).toBe("caretook-v2");
  });

  it("finds earlier versions' caches, keeping this one and caches that aren't ours", () => {
    expect(
      staleCaches(["caretook-v1", "caretook-v2", "caretook-v0", "other-app", "powersync"], "v2"),
    ).toEqual(["caretook-v1", "caretook-v0"]);
  });
});
