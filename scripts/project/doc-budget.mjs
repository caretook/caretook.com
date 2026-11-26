// The doc budget guard: keeps AGENTS.md and docs/ small (budgets in
// doc-budget.config.mjs).
//
//   node scripts/project/doc-budget.mjs [warn]
//       Lists the docs over budget with their sizes. Always exits 0, even if
//       the measuring itself fails (it runs inside `pnpm check`). Then, for
//       each topic in plans/backlog.md's registry not flagged done, warns when
//       its plan's _Status_ passes 6 KB (trim it: the tool's `status-trim`).
//   node scripts/project/doc-budget.mjs land <base> [--head <ref>] [--repo <dir>]
//       Exits 1 if any doc is over budget AND bigger than at <base>, naming
//       each with its size, budget and base size; 2 when it can't measure. --head measures that ref
//       instead of the working tree (land.sh passes the branch being landed).
//       Exit 1 is a breach and only that: any other failure (the budgets file
//       that doesn't load, an uncaught error) exits 2.
//
// A doc over budget that didn't grow (or shrank) never blocks anything.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readRisa, toolCommand } from "./risa.mjs";
import { STATUS_WARN_BYTES, statusBytes } from "./status-trim.mjs";

// The budgets, loaded here so a file that doesn't load is this command's own error (exit 2 in land
// mode, a skipped warning in warn mode), never Node's exit 1, which land.sh reads as a breach.
/** @type {{ pattern: string, bytes: number, landExempt?: boolean }[]} */
let BUDGETS = [];
/** @type {unknown} */
let budgetsError = null;
try {
  ({ BUDGETS } = await import("./doc-budget.config.mjs"));
} catch (e) {
  budgetsError = e;
}
const firstLine = (/** @type {unknown} */ e) => (e instanceof Error ? e.message : String(e)).split("\n")[0];

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

// What is measured: docs/ and each file a budget names by its exact path (AGENTS.md, the
// core's generic role docs until the move).
const exactPaths = () => BUDGETS.map((e) => e.pattern).filter((p) => !p.endsWith("/*.md"));
const isDoc = (p) => p.startsWith("docs/") || exactPaths().includes(p);

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
  for (const p of exactPaths().filter((p) => !p.startsWith("docs/"))) {
    try {
      sizes[p] = statSync(join(repo, p)).size;
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

// The backlog's registry table, read as the core's registry does (Caretook's
// copy of the part this needs, so the budget runs with no core present): its
// section heading is risa.json's backlog.prdsHeading in this checkout.
const REGISTRY_HEADER = ["PRD", "Flags", "After", "Hot files", "Doc and notes"];
const NONE = "—";
const prdsHeading = () =>
  readRisa(fileURLToPath(new URL("../..", import.meta.url)))?.backlog?.prdsHeading ?? "## PRDs";
/** "| a | b \\| c |" → ["a", "b | c"]. */
const cells = (line) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|"));
const unquote = (s) =>
  s
    .trim()
    .replace(/^`+|`+$/g, "")
    .trim();

/**
 * The registry's rows as { topic, flags }, or null when the backlog has no
 * table or one in the old format; a header this doesn't know throws.
 */
export function registryRows(text) {
  const heading = prdsHeading();
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && /^##? /.test(l));
  if (end < 0) end = lines.length;
  let at = lines.findIndex((l, i) => i > start && i < end && l.trim().startsWith("|"));
  if (at < 0) return null;
  const table = [];
  while (at < end && lines[at].trim().startsWith("|")) table.push(lines[at++]);
  const [head = "", ...body] = table;
  const header = cells(head);
  if (header.join("|") !== REGISTRY_HEADER.join("|")) {
    if (header[0] === "PRD" && header[1] === "Doc") return null;
    throw new Error(`the "${heading}" table's header isn't one this tool knows: ${head.trim()}`);
  }
  return body
    .filter((l) => !/^\|(\s*:?-+:?\s*\|)+\s*$/.test(l.trim()))
    .map(cells)
    .map(([topic = "", flags = ""]) => ({
      topic: unquote(topic),
      flags:
        !flags.trim() || flags.trim() === NONE || flags.trim() === "-"
          ? []
          : flags
              .split(",")
              .map(unquote)
              .filter((f) => f && f !== NONE),
    }));
}

/**
 * The running topics' plans whose _Status_ is over `limit` bytes, as
 * { topic, size }: every registry row not flagged done that has a plan.
 */
export function longStatuses(repo, limit = STATUS_WARN_BYTES) {
  const backlog = join(repo, "plans", "backlog.md");
  if (!existsSync(backlog)) return [];
  const rows = registryRows(readFileSync(backlog, "utf8"));
  if (!rows) return [];
  const out = [];
  for (const row of rows) {
    const plan = join(repo, "plans", `${row.topic}-plan.md`);
    if (row.flags.includes("done") || !existsSync(plan)) continue;
    const size = statusBytes(readFileSync(plan, "utf8"));
    if (size > limit) out.push({ topic: row.topic, size });
  }
  return out;
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
  if (budgetsError && mode === "warn") {
    out(`doc budget: skipped (the budgets didn't load: ${firstLine(budgetsError)})`);
    return 0;
  }
  if (budgetsError) {
    err(`doc budget: can't measure (the budgets didn't load: ${firstLine(budgetsError)})`);
    return 2;
  }
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
    try {
      for (const r of head ? [] : longStatuses(repo))
        out(
          `plan status: plans/${r.topic}-plan.md's _Status_ is ${kb(r.size)}, over ${kb(STATUS_WARN_BYTES)} (a warning): ${toolCommand(repo, "prd")} status-trim ${r.topic}`,
        );
    } catch (e) {
      out(`plan status: skipped (${e.message.split("\n")[0]})`);
    }
    return 0;
  }
  if (mode === "land") {
    const base = args.shift();
    if (!base) {
      err("usage: doc-budget.mjs land <base> [--head <ref>] [--repo <dir>]");
      return 2;
    }
    // Exit 1 means a breach and only that: a budget that can't measure exits 2.
    let grown;
    try {
      const baseSizes = docSizes(repo, base);
      grown = measure(docSizes(repo, head), baseSizes).filter(
        (r) => r.status === "grown" && !isLandExempt(r.path),
      );
    } catch (e) {
      err(`doc budget: can't measure (${e instanceof Error ? e.message.split("\n")[0] : e})`);
      return 2;
    }
    if (!grown.length) return 0;
    err(`doc budget: this landing grows ${grown.length} doc(s) that are over budget; trim them first:`);
    for (const r of grown) err(line(r));
    return 1;
  }
  err(`unknown mode ${mode} (warn | land <base>)`);
  return 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let code = 2;
  try {
    code = run(process.argv.slice(2));
  } catch (e) {
    console.error(`doc budget: failed (${firstLine(e)})`);
  }
  process.exit(code);
}
