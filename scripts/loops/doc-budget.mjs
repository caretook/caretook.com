// The doc budget guard: keeps AGENTS.md and docs/ small (budgets in
// doc-budget.config.mjs).
//
//   node scripts/loops/doc-budget.mjs [warn]
//       Lists the docs over budget with their sizes. Always exits 0, even if
//       the measuring itself fails (it runs inside `pnpm check`).
//   node scripts/loops/doc-budget.mjs land <base> [--head <ref>] [--repo <dir>]
//       Exits 1 if any doc is over budget AND bigger than at <base>, naming
//       each with its size, budget and base size. --head measures that ref
//       instead of the working tree (land.sh passes the branch being landed).
//
// A doc over budget that didn't grow (or shrank) never blocks anything.
import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { BUDGETS } from "./doc-budget.config.mjs";

/** The budget in bytes for a repo-relative path, or null if it has none. */
export function budgetFor(path, budgets = BUDGETS) {
  return entryFor(path, budgets)?.bytes ?? null;
}

/** Whether a path's budget only warns and never blocks a landing. */
export function isLandExempt(path, budgets = BUDGETS) {
  return entryFor(path, budgets)?.landExempt === true;
}

function entryFor(path, budgets) {
  for (const entry of budgets) {
    const { pattern } = entry;
    if (pattern.endsWith("/*.md")) {
      const dir = pattern.slice(0, -4);
      if (path.startsWith(dir) && path.endsWith(".md") && !path.slice(dir.length).includes("/")) return entry;
    } else if (pattern === path) return entry;
  }
  return null;
}

/**
 * Pure: measure `sizes` ({ path: bytes }) against budgets and `baseSizes`
 * ({ path: bytes }, missing = new file). Only budgeted paths are returned, as
 * { path, size, budget, base, status } with status within | over | grown.
 */
export function measure(sizes, baseSizes = {}, budgets = BUDGETS) {
  const out = [];
  for (const path of Object.keys(sizes).sort()) {
    const budget = budgetFor(path, budgets);
    if (budget === null) continue;
    const size = sizes[path];
    const base = path in baseSizes ? baseSizes[path] : null;
    const status = size <= budget ? "within" : size > (base ?? 0) ? "grown" : "over";
    out.push({ path, size, budget, base, status });
  }
  return out;
}

const git = (repo, ...args) =>
  execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const isDoc = (p) => p === "AGENTS.md" || p.startsWith("docs/");

/** { path: bytes } for the docs in the working tree, or at `ref`. */
export function docSizes(repo, ref = null) {
  const sizes = {};
  if (ref) {
    for (const p of git(repo, "ls-tree", "-r", "--name-only", ref).split("\n")) {
      if (p && isDoc(p) && budgetFor(p) !== null)
        sizes[p] = Number(git(repo, "cat-file", "-s", `${ref}:${p}`));
    }
    return sizes;
  }
  const walk = (rel) => {
    for (const name of readdirSync(join(repo, rel))) {
      const p = rel ? `${rel}/${name}` : name;
      if (statSync(join(repo, p)).isDirectory()) walk(p);
      else if (budgetFor(p) !== null) sizes[p] = statSync(join(repo, p)).size;
    }
  };
  if (budgetFor("AGENTS.md") !== null) {
    try {
      sizes["AGENTS.md"] = statSync(join(repo, "AGENTS.md")).size;
    } catch {
      /* absent */
    }
  }
  try {
    walk("docs");
  } catch {
    /* no docs/ */
  }
  return sizes;
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const line = (r) =>
  `  ${r.path}: ${r.size} B (${kb(r.size)}), budget ${r.budget} B (${kb(r.budget)}), ` +
  `${r.base === null ? "new file" : `base ${r.base} B`}`;

/** Runs the CLI; returns the exit code and writes to out/err. */
export function run(argv, { out = console.log, err = console.error } = {}) {
  const args = [...argv];
  const mode = args[0] && !args[0].startsWith("--") ? args.shift() : "warn";
  const opt = (name) => {
    const i = args.indexOf(name);
    return i < 0 ? null : args.splice(i, 2)[1];
  };
  const repo = opt("--repo") ?? process.cwd();
  const head = opt("--head");
  if (mode === "warn") {
    try {
      const over = measure(docSizes(repo, head)).filter((r) => r.status !== "within");
      if (over.length) {
        out(`doc budget: ${over.length} doc(s) over budget (a warning; a landing may not grow them):`);
        for (const r of over) out(line(r).replace(/, (base|new file).*$/, ""));
      } else out("doc budget: all docs within budget");
    } catch (e) {
      out(`doc budget: skipped (${e.message.split("\n")[0]})`);
    }
    return 0;
  }
  if (mode === "land") {
    const base = args.shift();
    if (!base) {
      err("usage: doc-budget.mjs land <base> [--head <ref>] [--repo <dir>]");
      return 2;
    }
    const baseSizes = docSizes(repo, base);
    const grown = measure(docSizes(repo, head), baseSizes).filter(
      (r) => r.status === "grown" && !isLandExempt(r.path),
    );
    if (!grown.length) return 0;
    err(`doc budget: this landing grows ${grown.length} doc(s) that are over budget; trim them first:`);
    for (const r of grown) err(line(r));
    return 1;
  }
  err(`unknown mode ${mode} (warn | land <base>)`);
  return 2;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(run(process.argv.slice(2)));
