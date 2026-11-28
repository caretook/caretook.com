import { describe, expect, it } from "vitest";

import { checkBudget, chunkName, formatTable, formatViolation, isRouteModule, packageOf } from "./budget.mjs";
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

describe("checkBudget: chunk shape (B-960, B-966)", () => {
  const icon = (name) => `/r/node_modules/.pnpm/l/node_modules/lucide-react/dist/esm/icons/${name}.mjs`;
  const route = "/r/apps/web/app/routes/app/groups/timeline/route.tsx?route-chunk=main";
  const shape = {
    together: { "lucide-react": ["icons", "icons-marketing", "icons-public"] },
    keepOut: { public: ["icons"], "sign-in": ["icons-marketing"] },
    noRoutesIn: ["entry"],
  };
  // The /app load: the app's icons in one chunk, beside the public pages' two.
  const modules = {
    "assets/icons-C02J4h90.js": [icon("pill"), icon("clock")],
    "assets/icons-public-CdgxWiiZ.js": [icon("x")],
    "assets/icons-marketing-DdVPgD5j.js": [icon("bot")],
    "app.js": [route],
  };
  const pages = (publicChunks, signIn = []) => ({
    ...listing(),
    groups: { ...listing().groups, public: ["entry.js", ...publicChunks], "sign-in": ["entry.js", ...signIn] },
    modules,
  });

  it("passes the app's icons in one chunk the public pages don't load", () => {
    const l = pages(
      ["assets/icons-public-CdgxWiiZ.js", "assets/icons-marketing-DdVPgD5j.js"],
      ["assets/icons-public-CdgxWiiZ.js"],
    );
    expect(checkBudget(l, shape)).toEqual([]);
  });

  it("reports a public page that loads the app's icons chunk", () => {
    const v = checkBudget(pages(["assets/icons-C02J4h90.js"]), shape);
    expect(v).toEqual([{ kind: "keepOut", group: "public", chunk: "assets/icons-C02J4h90.js" }]);
    expect(formatViolation(v[0])).toBe("public: loads assets/icons-C02J4h90.js, kept out of it");
  });

  it("reports sign-in loading the marketing pages' icons", () => {
    const v = checkBudget(pages([], ["assets/icons-marketing-DdVPgD5j.js"]), shape);
    expect(v).toEqual([{ kind: "keepOut", group: "sign-in", chunk: "assets/icons-marketing-DdVPgD5j.js" }]);
  });

  it("reports the app's icons split across chunks", () => {
    const l = { ...pages([]), modules: { ...modules, "assets/icons-Bx9kL2mQ.js": [icon("tag")] } };
    const v = checkBudget(l, shape);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ kind: "split", pattern: "lucide-react" });
    expect(formatViolation(v[0])).toMatch(/lucide-react is outside its named chunks, or split, across 4 chunks/);
  });

  it("reports an icon outside the named chunks", () => {
    const l = { ...pages([]), modules: { ...modules, "pill.js": [icon("pill")] } };
    expect(checkBudget(l, shape)).toEqual([
      { kind: "split", pattern: "lucide-react", chunks: [...Object.keys(modules).slice(0, 3), "pill.js"] },
    ]);
  });

  it("names a chunk by its file, less the hash", () => {
    expect(chunkName("assets/icons-C02J4h90.js")).toBe("icons");
    expect(chunkName("assets/icons-public-B4S4-dEs.js")).toBe("icons-public");
    expect(chunkName("assets/icons-marketing-Dd_PgD5j.js")).toBe("icons-marketing");
  });

  it("reports a route's own code merged into the entry", () => {
    const l = listing({ "entry.js": { gzip: 60, modules: ["/r/apps/web/app/entry.client.tsx", route] } });
    const v = checkBudget(l, shape);
    expect(v).toEqual([{ kind: "route", group: "entry", chunk: "entry.js", module: route }]);
    // The root route and our shared code aren't route modules.
    expect(isRouteModule("/r/apps/web/app/root.tsx")).toBe(false);
    expect(isRouteModule("/r/apps/web/app/lib/core/api.ts")).toBe(false);
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
      `"app":{"id":"app","parentId":"root","module":"/assets/app.js","imports":["/assets/r.js","/assets/x.js"]},` +
      `"routes/app/home/route":{"id":"routes/app/home/route","parentId":"app","module":"/assets/ah.js","imports":[]},` +
      `"routes/account/invite/route":{"id":"routes/account/invite/route","parentId":"root","module":"/assets/inv.js","imports":[]},` +
      `"marketing":{"id":"marketing","parentId":"root","module":"/assets/m.js","imports":[]},` +
      `"routes/marketing/home/route":{"id":"routes/marketing/home/route","parentId":"marketing","module":"/assets/mh.js","imports":["/assets/im.js"]},` +
      `"routes/sign-in":{"id":"routes/sign-in","parentId":"root","module":"/assets/si.js","imports":["/assets/ip.js"]}}};`,
  );
  const chunkModules = Object.fromEntries(
    ["e", "r", "root", "app", "x", "ah", "inv", "m", "mh", "im", "si", "ip"].map((c) => [`assets/${c}.js`, []]),
  );

  it("lists the entry, root and /app shell chunks once each, with sizes and modules", () => {
    const l = buildListing({ routeManifest, chunkModules: { ...chunkModules, "assets/e.js": ["a"] }, gzipOf: () => 10 });
    expect(l.groups.entry).toEqual(["assets/e.js", "assets/r.js"]);
    expect(l.groups.root).toEqual(["assets/e.js", "assets/r.js", "assets/root.js"]);
    expect(l.groups.app).toEqual(["assets/e.js", "assets/r.js", "assets/root.js", "assets/app.js", "assets/x.js"]);
    expect(l.chunks["assets/e.js"]).toEqual({ gzip: 10, modules: ["a"] });
    // Every chunk's modules, for the build-wide rules (`together`).
    expect(l.modules["assets/x.js"]).toEqual([]);
  });

  it("lists what / and /sign-in load, and every public page's chunks (B-966)", () => {
    const l = buildListing({ routeManifest, chunkModules, gzipOf: () => 10 });
    const base = ["assets/e.js", "assets/r.js", "assets/root.js"];
    expect(l.groups.home).toEqual([...base, "assets/m.js", "assets/mh.js", "assets/im.js"]);
    expect(l.groups["sign-in"]).toEqual([...base, "assets/si.js", "assets/ip.js"]);
    // Not the /app layout or its pages, nor invite (it counts as the app: chunks.mjs).
    expect(l.groups.public.toSorted()).toEqual(
      [...base, "assets/m.js", "assets/mh.js", "assets/im.js", "assets/si.js", "assets/ip.js"].toSorted(),
    );
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
