// The client build's chunk groups (apps/web/vite.config.ts), pure so they're unit-tested.
//
// B-960: the icons only the app reaches share one `icons` chunk, so the first
// /app load fetches one file for them, not one per icon. React has its own
// group, ahead of the icons, or the icons group would take React with it (a
// group takes its modules' dependencies) and drag every icon into the entry.
//
// B-966: the public pages (marketing, sign-in, the signed-out account pages)
// never fetch `icons`. An icon a public page reaches goes in `icons-public`
// with lucide-react's own code (createLucideIcon, Icon, …, which every icon
// imports), or in `icons-marketing` when only marketing pages reach it, so
// sign-in doesn't fetch the marketing sections' icons. The /app load fetches
// all three; a public page one or two. Invite and join count as the app: they
// render the app's own components (the repeat editor, visit prep) and lead
// into /app, so their icons stay in `icons` rather than in sign-in's chunk.
// Route chunks are left to the automatic split, so routes stay lazy.
// `pnpm build:budget` checks the shape (budget.json's `together` and `keepOut`).
//
// Which icons a module uses: `import { Pill } from "lucide-react"` resolves to
// lucide's barrel, which imports every icon, so the module graph alone can't
// tell. The plugin reads each module's named imports and the barrel's exports
// (name → icon file) as they're transformed.

const LUCIDE = /node_modules[\\/]lucide-react[\\/]/;
const LUCIDE_ICON = /node_modules[\\/]lucide-react[\\/]dist[\\/]esm[\\/]icons[\\/](?!index\.)([\w-]+)\.mjs$/;
const LUCIDE_BARREL = /node_modules[\\/]lucide-react[\\/]dist[\\/]esm[\\/]lucide-react\.mjs$/;

/** The kind of page a route file (or React Router route id) is: "app", "marketing" or "public". */
export function routeKind(path) {
  if (/(^|[\\/])routes[\\/]((app|admin|dev)[\\/]|account[\\/](invite|join)[\\/])/.test(path)) return "app";
  if (/(^|[\\/])routes[\\/]marketing[\\/]/.test(path)) return "marketing";
  return "public";
}

/** A React Router client route module (its build id carries this query). */
const isRouteModule = (id) => id.includes("?__react-router-build-client-route");

/** The icon a lucide module is (`pill` for …/icons/pill.mjs), else null. */
export const iconOf = (id) => LUCIDE_ICON.exec(id)?.[1] ?? null;

/** The names a module imports from lucide-react (`import { A, B as C } from "lucide-react"`: A, B). */
export function lucideNamesIn(code) {
  const names = [];
  for (const [, type, list] of code.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s*from\s*["']lucide-react["']/g)) {
    if (type) continue;
    for (const spec of list.split(",")) {
      const name = spec.trim().split(/\s+as\s+/)[0];
      if (name && !name.startsWith("type ")) names.push(name);
    }
  }
  return names;
}

/** The barrel's exports: name → icon (`Pill`, `PillIcon`, `LucidePill` → `pill`). */
export function barrelIcons(code) {
  const icons = new Map();
  for (const [, list, icon] of code.matchAll(/export\s*\{([^}]*)\}\s*from\s*["']\.\/icons\/([\w-]+)\.mjs["']/g)) {
    for (const spec of list.split(",")) {
      const name = spec.trim().split(/\s+as\s+/)[1];
      if (name) icons.set(name, icon);
    }
  }
  return icons;
}

/**
 * The kinds of page that reach a module: up its static importers to the route
 * modules and the entry (a module nothing imports statically); a lazily loaded
 * component (no static importers, not a route) is reached by whoever imports it.
 */
export function pageKinds(id, getModuleInfo) {
  const kinds = new Set();
  const seen = new Set([id]);
  const queue = [id];
  while (queue.length) {
    const current = queue.shift();
    const info = getModuleInfo(current);
    let importers = info?.importers ?? [];
    if (importers.length === 0) {
      if (isRouteModule(current) || !info?.dynamicImporters?.length) kinds.add(routeKind(current));
      else importers = info.dynamicImporters;
    }
    for (const importer of importers) {
      if (!seen.has(importer)) {
        seen.add(importer);
        queue.push(importer);
      }
    }
  }
  return kinds;
}

/** The group of an icon whose importing modules are `users`. */
export function iconGroup(users, getModuleInfo) {
  const kinds = new Set(users.flatMap((u) => [...pageKinds(u, getModuleInfo)]));
  if (kinds.has("public")) return "icons-public";
  if (kinds.has("marketing")) return "icons-marketing";
  return "icons";
}

/** The plugin that records lucide imports, and the `codeSplitting` option they feed, for both client builds. */
export function clientChunks() {
  const imports = new Map(); // module id → the names it imports from lucide-react
  let barrel = new Map(); // name → icon
  const users = (icon) =>
    [...imports].filter(([, names]) => names.some((n) => barrel.get(n) === icon)).map(([id]) => id);

  /** @type {import("vite").Plugin} */
  const plugin = {
    name: "caretook:lucide-imports",
    apply: "build",
    enforce: "pre",
    applyToEnvironment: (environment) => environment.name === "client",
    transform(code, id) {
      if (LUCIDE_BARREL.test(id)) barrel = barrelIcons(code);
      else if (!LUCIDE.test(id) && code.includes("lucide-react")) {
        const names = lucideNamesIn(code);
        if (names.length) imports.set(id, names);
      }
      return null;
    },
  };

  // Each icon's group, once. lucide-react's own code goes with the public icons.
  const groupOf = new Map();
  const group = (id, ctx) => {
    if (!groupOf.has(id)) {
      const icon = iconOf(id);
      groupOf.set(id, icon ? iconGroup(users(icon), (m) => ctx.getModuleInfo(m)) : "icons-public");
    }
    return groupOf.get(id);
  };
  // One group per chunk, the public ones first: a group takes its modules'
  // dependencies, so `icons` would otherwise take lucide's own code with it.
  const iconsGroup = (name, priority) => ({
    name: (id, ctx) => (group(id, ctx) === name ? name : null),
    debugName: name,
    test: LUCIDE,
    priority,
  });
  const codeSplitting = {
    groups: [
      { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 3 },
      iconsGroup("icons-public", 2),
      iconsGroup("icons-marketing", 1),
      iconsGroup("icons", 0),
    ],
  };
  return { plugin, codeSplitting };
}
