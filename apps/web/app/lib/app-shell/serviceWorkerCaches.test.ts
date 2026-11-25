import { describe, expect, it } from "vitest";

import { deleteStaleCaches, fetchAndKeep, fromCache, precache, type Caches } from "./serviceWorkerCaches";

/** An in-memory `CacheStorage`: each cache records what was added, by URL path. */
function fakeCaches(names: string[] = []) {
  const stores = new Map<string, Map<string, Request | string>>(names.map((n) => [n, new Map()]));
  const puts: { key: string; response: Response }[] = [];
  const caches: Caches = {
    open: (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      const cache = {
        addAll: (requests: (Request | string)[]) => {
          for (const r of requests) store.set(typeof r === "string" ? r : new URL(r.url).pathname, r);
          return Promise.resolve();
        },
        put: (key: string, response: Response) => {
          store.set(key, key);
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

describe("precache", () => {
  it("puts every path in this version's cache, the shell fetched past the HTTP cache", async () => {
    const { caches, stores } = fakeCaches();
    await precache(caches, "v2", ["/app", "/assets/a.js", "/assets/b.css"], "https://caretook.com");
    const store = stores.get("caretook-v2")!;
    expect([...store.keys()]).toEqual(["/app", "/assets/a.js", "/assets/b.css"]);
    const shell = store.get("/app") as Request;
    expect(shell).toBeInstanceOf(Request);
    expect(shell.cache).toBe("reload");
    expect(store.get("/assets/a.js")).toBe("/assets/a.js");
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
    await precache(caches, "v2", ["/app"], "https://caretook.com");
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
