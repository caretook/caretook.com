import { describe, expect, it } from "vitest";

import { barrelIcons, clientChunks, iconGroup, iconOf, lucideNamesIn, pageKinds, routeKind } from "./chunks.mjs";

const LUCIDE = "/r/node_modules/.pnpm/l/node_modules/lucide-react/dist/esm";
const icon = (name) => `${LUCIDE}/icons/${name}.mjs`;
const app = (path) => `/r/apps/web/app/${path}`;
const route = (path) => `${app(path)}?__react-router-build-client-route`;

// A module graph: id → { importers, dynamicImporters }.
const graph = (edges) => (id) => ({ importers: [], dynamicImporters: [], ...edges[id] });

describe("routeKind", () => {
  it("counts /app, admin, dev, invite and join as the app", () => {
    for (const path of [
      "routes/app/groups/timeline/route.tsx",
      "routes/admin/index/route.tsx",
      "routes/dev/ui/route.tsx",
      "routes/account/invite/route.tsx",
      "routes/account/join/route.tsx",
      "routes/app/home/route",
    ])
      expect(routeKind(app(path)), path).toBe("app");
  });

  it("tells marketing from the other public pages", () => {
    expect(routeKind(route("routes/marketing/home/route.tsx"))).toBe("marketing");
    expect(routeKind("routes/marketing/faq/route")).toBe("marketing");
    for (const path of ["routes/sign-in.tsx", "routes/account/reset-password/route.tsx", "root.tsx", "entry.client.tsx"])
      expect(routeKind(app(path)), path).toBe("public");
  });
});

describe("lucide imports", () => {
  it("reads a module's named imports, not its type imports", () => {
    const code = `import { Pill, X as Close,\n  type LucideIcon } from "lucide-react";\nimport type { IconNode } from 'lucide-react';`;
    expect(lucideNamesIn(code)).toEqual(["Pill", "X"]);
  });

  it("maps the barrel's every export name to its icon file", () => {
    const icons = barrelIcons(
      `export { default as LucidePill, default as Pill, default as PillIcon } from './icons/pill.mjs';\n` +
        `export { default as Fingerprint, default as FingerprintPattern } from './icons/fingerprint-pattern.mjs';`,
    );
    expect(icons.get("Pill")).toBe("pill");
    expect(icons.get("PillIcon")).toBe("pill");
    expect(icons.get("Fingerprint")).toBe("fingerprint-pattern");
  });

  it("knows an icon module from lucide's own code", () => {
    expect(iconOf(icon("map-pin"))).toBe("map-pin");
    expect(iconOf(`${LUCIDE}/icons/index.mjs`)).toBeNull();
    expect(iconOf(`${LUCIDE}/createLucideIcon.mjs`)).toBeNull();
  });
});

describe("pageKinds", () => {
  it("follows static importers up to the route modules", () => {
    const get = graph({
      [app("components/ui/Sheet.tsx")]: {
        importers: [route("routes/sign-in.tsx"), app("components/entry/EntryForm.tsx")],
      },
      [app("components/entry/EntryForm.tsx")]: { importers: [route("routes/app/groups/timeline/route.tsx")] },
    });
    expect([...pageKinds(app("components/ui/Sheet.tsx"), get)].sort()).toEqual(["app", "public"]);
    expect([...pageKinds(app("components/entry/EntryForm.tsx"), get)]).toEqual(["app"]);
  });

  it("follows a lazily loaded component to whoever loads it", () => {
    const get = graph({
      [app("components/visitPrep/VisitPrepSheet.tsx")]: {
        dynamicImporters: [route("routes/app/groups/provider/route.tsx")],
      },
    });
    expect([...pageKinds(app("components/visitPrep/VisitPrepSheet.tsx"), get)]).toEqual(["app"]);
  });

  it("survives an import cycle", () => {
    const a = app("lib/a.ts");
    const b = app("lib/b.ts");
    const get = graph({ [a]: { importers: [b] }, [b]: { importers: [a, route("routes/sign-in.tsx")] } });
    expect([...pageKinds(a, get)]).toEqual(["public"]);
  });
});

describe("iconGroup", () => {
  const get = graph({
    [app("routes/marketing/sections/icons.tsx")]: { importers: [route("routes/marketing/home/route.tsx")] },
  });

  it("puts an icon only the app reaches in `icons`", () => {
    expect(iconGroup([route("routes/app/groups/timeline/route.tsx")], get)).toBe("icons");
    // Imported by nothing the build kept: nobody public loads it.
    expect(iconGroup([], get)).toBe("icons");
  });

  it("keeps the public pages' icons out of `icons`", () => {
    const marketing = app("routes/marketing/sections/icons.tsx");
    expect(iconGroup([marketing, route("routes/app/home/route.tsx")], get)).toBe("icons-marketing");
    expect(iconGroup([marketing, route("routes/sign-in.tsx")], get)).toBe("icons-public");
  });
});

// The groups as Rolldown runs them: the plugin sees the modules' code, then each
// group's `name` decides, highest priority first.
describe("clientChunks (B-966)", () => {
  const timeline = route("routes/app/groups/timeline/route.tsx");
  const signIn = route("routes/sign-in.tsx");
  const home = route("routes/marketing/home/route.tsx");
  const barrel = `${LUCIDE}/lucide-react.mjs`;
  const ctx = { getModuleInfo: graph({}) };

  function groupsOf(modules) {
    const { plugin, codeSplitting } = clientChunks();
    plugin.transform(
      ["pill", "clock", "x", "bot"]
        .map((n) => `export { default as ${n[0].toUpperCase()}${n.slice(1)} } from './icons/${n}.mjs';`)
        .join("\n"),
      barrel,
    );
    for (const [id, code] of Object.entries(modules)) plugin.transform(code, id);
    const groups = [...codeSplitting.groups].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return (id) => {
      for (const g of groups) {
        const matches = g.test instanceof RegExp ? g.test.test(id) : true;
        const name = typeof g.name === "function" ? g.name(id, ctx) : g.name;
        if (matches && name) return name;
      }
      return null;
    };
  }

  const groupOf = groupsOf({
    [timeline]: `import { Pill, Clock, X } from "lucide-react";`,
    [signIn]: `import { X } from "lucide-react";`,
    [home]: `import { Bot, X } from "lucide-react";`,
  });

  it("puts the /app icons in one shared chunk no public page loads", () => {
    expect(groupOf(icon("pill"))).toBe("icons");
    expect(groupOf(icon("clock"))).toBe("icons");
  });

  it("gives the public pages their own icons, and lucide's code with them", () => {
    expect(groupOf(icon("x"))).toBe("icons-public");
    expect(groupOf(icon("bot"))).toBe("icons-marketing");
    expect(groupOf(`${LUCIDE}/createLucideIcon.mjs`)).toBe("icons-public");
    // `icons-public` first: a group takes its modules' dependencies.
    const order = clientChunks()
      .codeSplitting.groups.toSorted((a, b) => b.priority - a.priority)
      .map((g) => g.debugName ?? g.name);
    expect(order).toEqual(["react", "icons-public", "icons-marketing", "icons"]);
  });

  it("leaves everything else to the automatic split", () => {
    expect(groupOf(app("components/ui/Sheet.tsx"))).toBeNull();
    expect(groupOf("/r/node_modules/.pnpm/r/node_modules/react/index.js")).toBe("react");
  });
});
