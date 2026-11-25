import { describe, expect, it } from "vitest";

import {
  deleteStaleCaches,
  fetchAndKeep,
  fromCache,
  networkOrOffline,
  precache,
  PRECACHE_BACKOFF_MS,
  PRECACHE_CONCURRENCY,
  PRECACHE_TRIES,
  type Caches,
} from "./serviceWorkerCaches";
import { OFFLINE_PATH, routeRequest } from "./serviceWorkerRoutes";

/** An in-memory `CacheStorage`: each cache records what was put, by URL path. */
function fakeCaches(names: string[] = []) {
  const stores = new Map<string, Map<string, Request | string>>(names.map((n) => [n, new Map()]));
  const puts: { key: Request | string; response: Response }[] = [];
  const caches: Caches = {
    open: (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      const cache = {
        put: (key: Request | string, response: Response) => {
          store.set(typeof key === "string" ? key : new URL(key.url).pathname, key);
          puts.push({ key, response });
          return Promise.resolve();
        },
        match: (key: string) => Promise.resolve(store.has(key) ? new Response(`cached ${key}`) : undefined),
      };
      return Promise.resolve(cache as unknown as Cache);
    },
    keys: () => Promise.resolve([...stores.keys()]),
    delete: (name: string) => Promise.resolve(stores.delete(name)),
  };
  return { caches, stores, puts };
}

/** A precache fetch: 200s, except as `answer` says for a path (a status, or null to fail). */
function precacheFetch(answer: (path: string, attempt: number) => number | null = () => 200) {
  const tries = new Map<string, number>();
  const requests: Request[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const fetchFn = async (request: Request) => {
    requests.push(request);
    const path = new URL(request.url).pathname;
    const attempt = (tries.get(path) ?? 0) + 1;
    tries.set(path, attempt);
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 0));
    inFlight--;
    const status = answer(path, attempt);
    if (status === null) throw new TypeError("Failed to fetch");
    return new Response(`body ${path}`, { status });
  };
  const sleeps: number[] = [];
  const sleep = (ms: number) => {
    sleeps.push(ms);
    return Promise.resolve();
  };
  return { deps: { fetchFn, sleep }, tries, requests, sleeps, maxInFlight: () => maxInFlight };
}

const ORIGIN = "https://caretook.com";

describe("precache", () => {
  it("puts every path in this version's cache, the shell fetched past the HTTP cache", async () => {
    const { caches, stores } = fakeCaches();
    const net = precacheFetch();
    await precache(caches, "v2", ["/app", "/assets/a.js", "/assets/b.css"], ORIGIN, net.deps);
    const store = stores.get("caretook-v2")!;
    expect([...store.keys()].sort()).toEqual(["/app", "/assets/a.js", "/assets/b.css"]);
    const shell = net.requests.find((r) => new URL(r.url).pathname === "/app")!;
    expect(shell.cache).toBe("reload");
    expect(shell.credentials).toBe("same-origin");
    const asset = net.requests.find((r) => new URL(r.url).pathname === "/assets/a.js")!;
    expect(asset.cache).toBe("default");
    expect(asset.url).toBe(`${ORIGIN}/assets/a.js`);
  });

  // B-787: one dropped request on a flaky network no longer fails the install.
  it("retries a path that fails once, with a backoff, and installs", async () => {
    const { caches, stores } = fakeCaches();
    const net = precacheFetch((path, attempt) => (path === "/assets/a.js" && attempt === 1 ? null : 200));
    await precache(caches, "v2", ["/app", "/offline.html", "/assets/a.js"], ORIGIN, net.deps);
    expect(net.tries.get("/assets/a.js")).toBe(2);
    expect(net.sleeps).toEqual([PRECACHE_BACKOFF_MS]);
    expect([...stores.get("caretook-v2")!.keys()].sort()).toEqual(["/app", "/assets/a.js", "/offline.html"]);
  });

  it("retries the shell past the HTTP cache too", async () => {
    const { caches } = fakeCaches();
    const net = precacheFetch((path, attempt) => (path === "/app" && attempt < 3 ? 503 : 200));
    await precache(caches, "v2", ["/app"], ORIGIN, net.deps);
    const shells = net.requests.filter((r) => new URL(r.url).pathname === "/app");
    expect(shells.map((r) => r.cache)).toEqual(["reload", "reload", "reload"]);
  });

  it("fails the install when a path fails every try, never storing a bad answer", async () => {
    for (const status of [null, 404, 500, 206]) {
      const { caches, puts } = fakeCaches();
      const net = precacheFetch((path) => (path === "/offline.html" ? status : 200));
      await expect(precache(caches, "v2", ["/app", "/offline.html"], ORIGIN, net.deps)).rejects.toThrow(
        TypeError,
      );
      expect(net.tries.get("/offline.html")).toBe(PRECACHE_TRIES);
      expect(net.sleeps).toEqual(
        Array.from({ length: PRECACHE_TRIES - 1 }, (_, i) => PRECACHE_BACKOFF_MS * 2 ** i),
      );
      expect(puts.map((p) => new URL((p.key as Request).url).pathname)).toEqual(["/app"]);
    }
  });

  it("stops starting fetches once a path has failed", async () => {
    const { caches } = fakeCaches();
    const paths = Array.from({ length: 100 }, (_, i) => `/assets/${i}.js`);
    const net = precacheFetch((path) => (path === "/assets/0.js" ? null : 200));
    await expect(precache(caches, "v2", paths, ORIGIN, net.deps)).rejects.toThrow(TypeError);
    expect(net.tries.size).toBeLessThan(paths.length);
  });

  it("never runs more than the bound at once", async () => {
    const { caches, stores } = fakeCaches();
    const paths = Array.from({ length: 530 }, (_, i) => `/assets/${i}.js`);
    const net = precacheFetch((path, attempt) => (path.endsWith("7.js") && attempt === 1 ? null : 200));
    await precache(caches, "v2", paths, ORIGIN, net.deps);
    expect(net.maxInFlight()).toBe(PRECACHE_CONCURRENCY);
    expect(stores.get("caretook-v2")!.size).toBe(paths.length);
  });
});

describe("deleteStaleCaches", () => {
  it("deletes earlier versions only", async () => {
    const { caches, stores } = fakeCaches(["caretook-v1", "caretook-v2", "elsewhere"]);
    expect(await deleteStaleCaches(caches, "v2")).toEqual(["caretook-v1"]);
    expect([...stores.keys()]).toEqual(["caretook-v2", "elsewhere"]);
  });

  it("deletes nothing on a first install", async () => {
    const { caches } = fakeCaches(["caretook-v2"]);
    expect(await deleteStaleCaches(caches, "v2")).toEqual([]);
  });
});

describe("fromCache", () => {
  it("answers from this version's cache, or nothing", async () => {
    const { caches } = fakeCaches();
    await precache(caches, "v2", ["/app"], ORIGIN, precacheFetch().deps);
    expect(await (await fromCache(caches, "v2", "/app"))?.text()).toBe("cached /app");
    expect(await fromCache(caches, "v2", "/assets/missing.js")).toBeUndefined();
    // Another version's cache isn't read.
    expect(await fromCache(caches, "v3", "/app")).toBeUndefined();
  });
});

/** A fetch answering with `response`, or failing as the network does offline. */
const answering =
  (response: Response | null, type: ResponseType = "basic") =>
  (): Promise<Response> => {
    if (!response) return Promise.reject(new TypeError("Failed to fetch"));
    Object.defineProperty(response, "type", { value: type });
    return Promise.resolve(response);
  };

// B-777: offline, a file a worker loads (SQLite's WASM) must come from the cache.
describe("fetchAndKeep", () => {
  const wasm = "/assets/wa-sqlite-xyz.wasm";
  const request = new Request(`https://caretook.com${wasm}`);

  it("stores a good answer in this version's cache, so the next request is answered offline", async () => {
    const { caches, puts } = fakeCaches();
    const response = await fetchAndKeep(caches, "v2", wasm, request, answering(new Response("wasm")));
    expect(await response.text()).toBe("wasm");
    expect(puts.map((p) => p.key)).toEqual([wasm]);
    expect(await (await fromCache(caches, "v2", wasm))?.text()).toBe(`cached ${wasm}`);
    expect(await fromCache(caches, "v3", wasm)).toBeUndefined();
  });

  it("passes on an error, a partial or an opaque answer without storing it", async () => {
    const { caches, puts } = fakeCaches();
    for (const [answer, type] of [
      [new Response("gone", { status: 404 }), "basic"],
      [new Response("part", { status: 206 }), "basic"],
      [new Response("err", { status: 500 }), "basic"],
      [new Response("x"), "opaque"],
    ] as const) {
      const response = await fetchAndKeep(caches, "v2", wasm, request, answering(answer, type));
      expect(response.status).toBe(answer.status);
    }
    expect(puts).toEqual([]);
  });

  it("rejects as the network does when offline, storing nothing", async () => {
    const { caches, puts } = fakeCaches();
    await expect(fetchAndKeep(caches, "v2", wasm, request, answering(null))).rejects.toThrow(TypeError);
    expect(puts).toEqual([]);
  });
});

// B-788: offline, a direct load of / or /sign-in gets the offline page, not the browser's own.
describe("networkOrOffline", () => {
  const installed = async () => {
    const fake = fakeCaches();
    await precache(fake.caches, "v2", ["/app", OFFLINE_PATH], ORIGIN, precacheFetch().deps);
    return fake;
  };
  const navigation = (path: string) => new Request(new URL(path, ORIGIN));
  const routeOf = (path: string) =>
    routeRequest({ url: new URL(path, ORIGIN), mode: "navigate" }, ORIGIN, new Set(["/app", OFFLINE_PATH]));

  it("answers a failed load of / or /sign-in with the offline page", async () => {
    const { caches } = await installed();
    for (const path of ["/", "/sign-in"]) {
      expect(routeOf(path)).toBe("offline");
      const response = await networkOrOffline(caches, "v2", navigation(path), answering(null));
      expect(await response.text()).toBe(`cached ${OFFLINE_PATH}`);
    }
  });

  it("answers with the network's own answer when there is one, an error page too, storing nothing", async () => {
    const { caches, puts } = await installed();
    const installPuts = puts.length;
    const page = await networkOrOffline(caches, "v2", navigation("/"), answering(new Response("home")));
    expect(await page.text()).toBe("home");
    const missing = await networkOrOffline(
      caches,
      "v2",
      navigation("/sign-in"),
      answering(new Response("gone", { status: 503 })),
    );
    expect(missing.status).toBe(503);
    expect(puts).toHaveLength(installPuts);
  });

  it("rejects as the network did when the offline page isn't cached", async () => {
    const { caches } = fakeCaches();
    await expect(networkOrOffline(caches, "v2", navigation("/"), answering(null))).rejects.toThrow(TypeError);
  });

  it("leaves /app page loads to the shell", () => {
    expect(routeOf("/app")).toBe("shell");
    expect(routeOf("/app/groups/g1/timeline")).toBe("shell");
  });
});
