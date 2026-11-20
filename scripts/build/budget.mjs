// The bundle budget, pure: checkBudget(listing, budget) → violations.
//
// A listing (manifest.mjs) names the initial chunks of each group (the entry,
// the root route, the /app shell) and what's in every chunk:
//   { groups: { <name>: [chunk, …] }, chunks: { <chunk>: { gzip, modules: [id, …] } } }
// A budget (budget.json):
//   { forbidden: [prefix, …], forbiddenIn: [group, …], ceilings: { <group>: gzip bytes } }
// A forbidden prefix matches a module's package name (`@tiptap/starter-kit`,
// `yjs`) or, for our own files, its repo-relative path.

/** The package a module id belongs to (`@scope/name` or `name`), else the id itself. */
export function packageOf(id) {
  const at = id.lastIndexOf("node_modules/");
  if (at < 0) return id;
  const parts = id.slice(at + "node_modules/".length).split("/");
  return parts[0].startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/** Violations: `{ kind: "forbidden", group, chunk, module, pattern }` and `{ kind: "size", group, size, limit }`. */
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
  return violations;
}

/** The gzip bytes of a group's initial chunks. */
export function groupSize(listing, group) {
  return (listing.groups[group] ?? []).reduce((sum, chunk) => sum + (listing.chunks[chunk]?.gzip ?? 0), 0);
}

/** A module id without the pnpm store prefix. */
const shortId = (id) => id.slice(id.lastIndexOf("node_modules/") + (id.includes("node_modules/") ? 13 : 0));

export function formatViolation(v) {
  return v.kind === "forbidden"
    ? `${v.group}: ${v.chunk} contains ${shortId(v.module)} (forbidden: ${v.pattern})`
    : `${v.group}: ${v.size} B gzip is over its ${v.limit} B ceiling`;
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
