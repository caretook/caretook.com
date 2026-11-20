import { describe, expect, it } from "vitest";

import { checkBudget, formatTable, packageOf } from "./budget.mjs";
import { buildListing, parseRouteManifest } from "./manifest.mjs";

const budget = {
  forbidden: ["@tiptap/", "yjs", "y-", "prosemirror-", "@powersync/"],
  forbiddenIn: ["entry", "app"],
  ceilings: { entry: 100, app: 300 },
};
const listing = (over = {}) => ({
  groups: { entry: ["entry.js"], root: ["entry.js", "root.js"], app: ["entry.js", "root.js", "app.js"] },
  chunks: {
    "entry.js": { gzip: 60, modules: ["/r/node_modules/.pnpm/react@19/node_modules/react/index.js"] },
    "root.js": { gzip: 40, modules: ["/r/apps/web/app/root.tsx"] },
    "app.js": { gzip: 50, modules: ["/r/apps/web/app/routes/app/layout/route.tsx"] },
    ...over,
  },
});

describe("checkBudget", () => {
  it("passes a clean listing", () => {
    expect(checkBudget(listing(), budget)).toEqual([]);
  });

  it("reports a forbidden module in the entry with its chunk", () => {
    const l = listing({
      "entry.js": { gzip: 60, modules: ["/r/node_modules/.pnpm/x/node_modules/@tiptap/react/dist/index.js"] },
    });
    const v = checkBudget(l, budget);
    expect(v).toContainEqual({
      kind: "forbidden",
      group: "entry",
      chunk: "entry.js",
      module: "/r/node_modules/.pnpm/x/node_modules/@tiptap/react/dist/index.js",
      pattern: "@tiptap/",
    });
    // The entry is in the app shell too, so the shell reports it as well.
    expect(v.map((x) => x.group)).toEqual(["entry", "app"]);
  });

  it("reports a forbidden module in an app shell chunk only", () => {
    const l = listing({
      "app.js": { gzip: 50, modules: ["/r/node_modules/.pnpm/y/node_modules/yjs/dist/yjs.mjs"] },
    });
    const v = checkBudget(l, budget);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ group: "app", chunk: "app.js", pattern: "yjs" });
  });

  it("matches package names, not substrings", () => {
    const l = listing({
      "root.js": { gzip: 40, modules: ["/r/node_modules/.pnpm/a/node_modules/array-flatten/index.js"] },
    });
    expect(checkBudget(l, budget)).toEqual([]);
    const p = listing({
      "root.js": { gzip: 40, modules: ["/r/node_modules/.pnpm/a/node_modules/@powersync/web/index.js"] },
    });
    // root isn't checked on its own, but the app shell includes it.
    expect(checkBudget(p, budget).map((v) => v.group)).toEqual(["app"]);
  });

  it("reports a group over its ceiling", () => {
    const l = listing({ "root.js": { gzip: 200, modules: [] } });
    expect(checkBudget(l, budget)).toEqual([{ kind: "size", group: "app", size: 310, limit: 300 }]);
  });
});

describe("packageOf", () => {
  it("names the package, scoped or not, or keeps our own path", () => {
    expect(packageOf("/r/node_modules/.pnpm/p/node_modules/@tiptap/core/dist/a.js")).toBe("@tiptap/core");
    expect(packageOf("/r/node_modules/.pnpm/p/node_modules/yjs/dist/a.js")).toBe("yjs");
    expect(packageOf("/r/apps/web/app/root.tsx")).toBe("/r/apps/web/app/root.tsx");
  });
});

describe("buildListing", () => {
  const routeManifest = parseRouteManifest(
    `window.__reactRouterManifest={"entry":{"module":"/assets/e.js","imports":["/assets/r.js"]},"routes":{` +
      `"root":{"id":"root","module":"/assets/root.js","imports":["/assets/r.js"]},` +
      `"app":{"id":"app","parentId":"root","module":"/assets/app.js","imports":["/assets/r.js","/assets/x.js"]}}};`,
  );

  it("lists the entry, root and /app shell chunks once each, with sizes and modules", () => {
    const l = buildListing({
      routeManifest,
            chunkModules: { "assets/e.js": ["a"], "assets/r.js": ["b"], "assets/root.js": [], "assets/app.js": [], "assets/x.js": [] },
      gzipOf: () => 10,
    });
    expect(l.groups.entry).toEqual(["assets/e.js", "assets/r.js"]);
    expect(l.groups.root).toEqual(["assets/e.js", "assets/r.js", "assets/root.js"]);
    expect(l.groups.app).toEqual(["assets/e.js", "assets/r.js", "assets/root.js", "assets/app.js", "assets/x.js"]);
    expect(l.chunks["assets/e.js"]).toEqual({ gzip: 10, modules: ["a"] });
  });

  it("refuses a chunk with no module list", () => {
    expect(() => buildListing({ routeManifest, chunkModules: {}, gzipOf: () => 0 })).toThrow(/no module list/);
  });
});

describe("formatTable", () => {
  it("prints group, chunks, size and limit", () => {
    expect(formatTable(listing(), budget)).toContain("entry");
    expect(formatTable(listing(), budget)).toMatch(/app\s+3\s+150 B\s+300 B/);
  });
});
