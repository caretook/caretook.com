import { describe, expect, it } from "vitest";

import { deleteStaleCaches, fromCache, precache, type Caches } from "./serviceWorkerCaches";

/** An in-memory `CacheStorage`: each cache records what was added, by URL path. */
function fakeCaches(names: string[] = []) {
  const stores = new Map<string, Map<string, Request | string>>(names.map((n) => [n, new Map()]));
  const caches: Caches = {
    open: (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      const cache = {
        addAll: (requests: (Request | string)[]) => {
          for (const r of requests) store.set(typeof r === "string" ? r : new URL(r.url).pathname, r);
          return Promise.resolve();
        },
        match: (key: string) => Promise.resolve(store.has(key) ? new Response(`cached ${key}`) : undefined),
      };
      return Promise.resolve(cache as unknown as Cache);
    },
    keys: () => Promise.resolve([...stores.keys()]),
    delete: (name: string) => Promise.resolve(stores.delete(name)),
  };
  return { caches, stores };
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
