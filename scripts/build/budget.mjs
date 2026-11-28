// The bundle budget, pure: checkBudget(listing, budget) → violations.
//
// A listing (manifest.mjs) names the initial chunks of each group (the entry,
// the root route, the /app shell), what's in each of them, and the modules of
// every chunk of the build:
//   { groups: { <name>: [chunk, …] }, chunks: { <chunk>: { gzip, modules: [id, …] } },
//     modules: { <chunk>: [id, …] } }
// A budget (budget.json):
//   { forbidden: [prefix, …], forbiddenIn: [group, …], ceilings: { <group>: gzip bytes },
//     together: { <prefix>: [chunk name, …] }, keepOut: { <group>: [chunk name, …] }, noRoutesIn: [group, …] }
// A forbidden prefix matches a module's package name (`@tiptap/starter-kit`,
// `yjs`) or, for our own files, its repo-relative path. A `together` package
// (lucide-react's icons, B-960) is only in the named chunks of the whole build
// (a chunk's name is its file's, less the hash: `icons` for assets/icons-C02J4h90.js),
// one chunk each, not split across many small ones. A `keepOut` group loads
// none of the named chunks (the public pages and the app's icons, B-966). A
// `noRoutesIn` group holds no route's own code (apps/web/app/routes/): routes stay lazy.

/** The package a module id belongs to (`@scope/name` or `name`), else the id itself. */
export function packageOf(id) {
  const at = id.lastIndexOf("node_modules/");
  if (at < 0) return id;
  const parts = id.slice(at + "node_modules/".length).split("/");
  return parts[0].startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/** A module of a route (apps/web/app/routes/…, React Router's route chunks included). */
export const isRouteModule = (id) => /(^|[\\/])app[\\/]routes[\\/]/.test(id);

/** A chunk's name: its file name less the directory, the hash and `.js` (`assets/icons-C02J4h90.js`: `icons`). */
export const chunkName = (file) => file.replace(/^.*\//, "").replace(/-[\w-]{8}\.js$/, "");

/**
 * Violations: `{ kind: "forbidden", group, chunk, module, pattern }`, `{ kind: "size", group, size, limit }`,
 * `{ kind: "split", pattern, chunks }`, `{ kind: "keepOut", group, chunk }` and `{ kind: "route", group, chunk, module }`.
 */
export function checkBudget(listing, budget) {
  const violations = [];
  for (const group of budget.forbiddenIn ?? Object.keys(listing.groups)) {
    for (const chunk of listing.groups[group] ?? []) {
      for (const module of listing.chunks[chunk]?.modules ?? []) {
        const name = packageOf(module);
        const pattern = (budget.forbidden ?? []).find((p) => name.startsWith(p));
        if (pattern) violations.push({ kind: "forbidden", group, chunk, module, pattern });
      }
    }
  }
  for (const [group, limit] of Object.entries(budget.ceilings ?? {})) {
    const size = groupSize(listing, group);
    if (size > limit) violations.push({ kind: "size", group, size, limit });
  }
  for (const [pattern, names] of Object.entries(budget.together ?? {})) {
    const chunks = Object.keys(listing.modules ?? {}).filter((chunk) =>
      listing.modules[chunk].some((m) => packageOf(m).startsWith(pattern)),
    );
    const named = (name) => chunks.filter((chunk) => chunkName(chunk) === name);
    if (chunks.some((chunk) => !names.includes(chunkName(chunk))) || names.some((n) => named(n).length > 1))
      violations.push({ kind: "split", pattern, chunks });
  }
  for (const [group, names] of Object.entries(budget.keepOut ?? {})) {
    for (const chunk of listing.groups[group] ?? []) {
      if (names.includes(chunkName(chunk))) violations.push({ kind: "keepOut", group, chunk });
    }
  }
  for (const group of budget.noRoutesIn ?? []) {
    for (const chunk of listing.groups[group] ?? []) {
      const module = listing.chunks[chunk]?.modules.find(isRouteModule);
      if (module) violations.push({ kind: "route", group, chunk, module });
    }
  }
  return violations;
}

/** The gzip bytes of a group's initial chunks. */
export function groupSize(listing, group) {
  return (listing.groups[group] ?? []).reduce((sum, chunk) => sum + (listing.chunks[chunk]?.gzip ?? 0), 0);
}

/** A module id without the pnpm store prefix. */
const shortId = (id) => id.slice(id.lastIndexOf("node_modules/") + (id.includes("node_modules/") ? 13 : 0));

export function formatViolation(v) {
  if (v.kind === "forbidden") return `${v.group}: ${v.chunk} contains ${shortId(v.module)} (forbidden: ${v.pattern})`;
  if (v.kind === "split")
    return `${v.pattern} is outside its named chunks, or split, across ${v.chunks.length} chunks: ${v.chunks.join(", ")}`;
  if (v.kind === "keepOut") return `${v.group}: loads ${v.chunk}, kept out of it`;
  if (v.kind === "route") return `${v.group}: ${v.chunk} contains the route module ${v.module}`;
  return `${v.group}: ${v.size} B gzip is over its ${v.limit} B ceiling`;
}

/** The table `pnpm build:budget` prints: group, chunks, size, limit. */
export function formatTable(listing, budget) {
  const rows = [["group", "chunks", "gzip", "limit"]];
  for (const group of Object.keys(listing.groups)) {
    const limit = budget.ceilings?.[group];
    rows.push([
      group,
      String(listing.groups[group].length),
      `${groupSize(listing, group)} B`,
      limit === undefined ? "-" : `${limit} B`,
    ]);
  }
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  return rows.map((r) => r.map((c, i) => c.padEnd(widths[i])).join("  ").trimEnd()).join("\n");
}
