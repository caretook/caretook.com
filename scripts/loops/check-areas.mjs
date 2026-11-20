#!/usr/bin/env node
// Which browser checks a changed file needs: the rules in scripts/loops/check-areas.d/,
// resolved most specific first. `pnpm prd browser --changed` (browser.sh) calls this.
//
// Rule files: one per area (check-areas.d/<area>), plus _global for docs,
// tooling, config, build and the checks themselves. One rule per line: a glob
// (bash pattern: * also matches /, ? and [...] as in bash), then the checks it
// needs as plain names, or `-` for none, `@suite` for the lean set, or `@self`
// (a check file runs itself; one the change deleted needs nothing). # starts a
// comment line.
//
// Most specific wins, across every file: among the rules whose glob matches,
// the one with the longest literal prefix before its first wildcard, then the
// fewest wildcards, then the longest glob. The order of files and lines never
// matters. A tie left after that is an error (the lint finds it).
//
// Before the rules, one built-in: a test file (*.test.ts, .tsx or .mjs, which
// covers .int.test.ts, .browser.test.tsx and .sync.test.ts) needs no browser
// check: pnpm check runs it. It sits above the rules because a folder's rule
// is always more specific than a suffix like *.test.ts, so a suffix rule could
// never win against one.
//
// After the rules, two built-in fallbacks:
//   - a .ts/.tsx module under apps/web/app/lib/ with a sibling .test.ts needs
//     no check (its unit tests cover it), unless it ends in .sync.ts(x) or sits
//     under lib/sync/: device queries still run their area's checks;
//   - anything else gets UNMAPPED_DEFAULT, with a warning to add a rule.
//
//   node check-areas.mjs resolve [--root DIR] [--areas DIR] [file…]
//     prints "<file>\t<checks>" per file (files from stdin when none are given):
//     the checks, "-", "- (deleted)", "- (unit-tested)", "@suite", or
//     "UNMAPPED <default checks>". A tie exits 2 and names the rules.
//   node check-areas.mjs lint [--root DIR] [--areas DIR]
//     checks the rules against `git ls-files`: every tracked file resolves, no
//     rule is dead, no glob is written twice, no tie. Exits 1 with the problems.
//
// DIR defaults to the repo this file sits in; --areas to DIR/scripts/loops/check-areas.d.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** The checks a file no rule covers runs, with a warning. */
export const UNMAPPED_DEFAULT = "sign-in phase2 roundtrip";

/** Test files: pnpm check runs them, so they need no browser check, whatever folder they sit in. */
export const TEST_FILE = /\.test\.(ts|tsx|mjs)$/;

/** A bash pattern's tokens: literals, `*`, `?` and `[...]` classes. */
function tokens(glob) {
  const out = [];
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "\\" && i + 1 < glob.length) out.push({ lit: glob[++i] });
    else if (ch === "*" || ch === "?") out.push({ wild: ch });
    else if (ch === "[") {
      // A class runs to the next ], where a ] right after [ (or [! / [^) is literal.
      let j = i + 1;
      if (glob[j] === "!" || glob[j] === "^") j++;
      if (glob[j] === "]") j++;
      while (j < glob.length && glob[j] !== "]") j++;
      if (j >= glob.length) out.push({ lit: ch });
      else {
        out.push({ wild: "[", body: glob.slice(i + 1, j) });
        i = j;
      }
    } else out.push({ lit: ch });
  }
  return out;
}

const escape = (s) => s.replace(/[\\^$.*+?()[\]{}|/-]/g, "\\$&");

/** The glob as an anchored RegExp, with bash's [[ == ]] meaning (* crosses /). */
export function globToRegExp(glob) {
  let src = "";
  for (const t of tokens(glob)) {
    if (t.lit !== undefined) src += escape(t.lit);
    else if (t.wild === "*") src += ".*";
    else if (t.wild === "?") src += ".";
    else {
      let body = t.body;
      let neg = "";
      if (body[0] === "!" || body[0] === "^") {
        neg = "^";
        body = body.slice(1);
      }
      src += `[${neg}${body.replace(/[\\\]]/g, "\\$&")}]`;
    }
  }
  return new RegExp(`^${src}$`, "s");
}

/** How specific a glob is: its literal prefix's length, its wildcards, its length. */
export function specificity(glob) {
  const ts = tokens(glob);
  const first = ts.findIndex((t) => t.wild !== undefined);
  return {
    prefix: first === -1 ? ts.length : first,
    wildcards: ts.filter((t) => t.wild !== undefined).length,
    length: glob.length,
  };
}

/** < 0 when rule a is more specific than b, > 0 when less, 0 for a tie. */
export function compareSpecificity(a, b) {
  const x = specificity(a.glob);
  const y = specificity(b.glob);
  return y.prefix - x.prefix || x.wildcards - y.wildcards || y.length - x.length;
}

/**
 * One rule file's rules: { glob, checks, source, line }, where checks is the
 * rest of the line ("-", "@suite", "@self" or check names, one space apart).
 * Throws on a rule with no checks.
 */
export function parseRules(text, source = "rules") {
  const rules = [];
  text.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const [glob, ...words] = line.split(/\s+/);
    if (!words.length)
      throw new Error(`${source}:${i + 1}: a rule needs checks, -, @suite or @self: ${line}`);
    rules.push({ glob, checks: words.join(" "), source, line: i + 1, re: globToRegExp(glob) });
  });
  return rules;
}

/** Every rule in a check-areas.d folder (files in name order; the order doesn't matter). */
export function loadRules(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort()
    .flatMap((name) => parseRules(readFileSync(join(dir, name), "utf8"), name));
}

/** The matching rules, most specific first. */
export function matching(file, rules) {
  return rules.filter((r) => r.re.test(file)).sort(compareSpecificity);
}

const where = (r) => `${r.source}:${r.line} ${r.glob}`;

/**
 * A file's checks: { checks, rule?, tie? }. checks is what browser.sh prints:
 * names, "-", "- (deleted)", "- (unit-tested)", "@suite" or
 * "UNMAPPED <default>". tie, when set, lists the equally specific rules (the
 * first of them still gives the answer). exists(path) says whether a path
 * exists in the tree (for @self and the unit-tested fallback).
 */
export function resolveFile(file, rules, exists) {
  if (TEST_FILE.test(file)) return { checks: "-" };
  const found = matching(file, rules);
  if (found.length) {
    const rule = found[0];
    const tied = found.filter((r) => compareSpecificity(r, rule) === 0);
    const tie = tied.length > 1 ? tied : undefined;
    if (rule.checks === "@self") {
      const checks = !file.endsWith(".mjs") ? "-" : exists(file) ? basename(file, ".mjs") : "- (deleted)";
      return { checks, rule, tie };
    }
    return { checks: rule.checks, rule, tie };
  }
  if (
    file.startsWith("apps/web/app/lib/") &&
    !file.startsWith("apps/web/app/lib/sync/") &&
    /\.tsx?$/.test(file) &&
    !/\.sync\.tsx?$/.test(file) &&
    exists(`${file.replace(/\.[^.]+$/, "")}.test.ts`)
  )
    return { checks: "- (unit-tested)" };
  return { checks: `UNMAPPED ${UNMAPPED_DEFAULT}` };
}

/**
 * The rules' problems against a file list (every tracked file): files no rule
 * or fallback covers, rules that match nothing (test files don't count: they
 * never reach the rules), globs written twice, and ties.
 */
export function lint(rules, files, exists) {
  const problems = [];
  const seen = new Map();
  for (const r of rules) {
    const first = seen.get(r.glob);
    if (first) problems.push(`duplicate glob ${r.glob}: ${where(first)} and ${where(r)}`);
    else seen.set(r.glob, r);
  }
  const used = new Set();
  const ties = new Set();
  for (const file of files) {
    if (!TEST_FILE.test(file)) for (const r of rules) if (r.re.test(file)) used.add(r);
    const { checks, tie } = resolveFile(file, rules, exists);
    if (checks.startsWith("UNMAPPED")) problems.push(`no rule for ${file}`);
    // A tie between copies of one glob is the duplicate above, reported once.
    if (tie && new Set(tie.map((r) => r.glob)).size > 1) {
      const key = tie.map(where).join(" = ");
      if (!ties.has(key)) {
        ties.add(key);
        problems.push(`tie for ${file}: ${key}`);
      }
    }
  }
  for (const r of rules) if (!used.has(r)) problems.push(`dead rule ${where(r)}: matches no tracked file`);
  return problems;
}

const repoRoot = () => fileURLToPath(new URL("../..", import.meta.url)).replace(/\/$/, "");

function main(argv) {
  const [cmd, ...rest] = argv;
  let root = repoRoot();
  let areas = "";
  const files = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--root") root = rest[++i];
    else if (rest[i] === "--areas") areas = rest[++i];
    else files.push(rest[i]);
  }
  areas ||= join(root, "scripts/loops/check-areas.d");
  if (!existsSync(areas)) {
    console.error(`check-areas: no rules folder ${areas}`);
    return 1;
  }
  const rules = loadRules(areas);
  const exists = (p) => existsSync(join(root, p));
  if (cmd === "resolve") {
    if (!files.length)
      files.push(
        ...readFileSync(0, "utf8")
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
      );
    let status = 0;
    for (const file of files) {
      const { checks, tie } = resolveFile(file, rules, exists);
      if (tie) {
        console.error(`check-areas: tie for ${file}: ${tie.map(where).join(" = ")} (make one more specific)`);
        status = 2;
      }
      console.log(`${file}\t${checks}`);
    }
    return status;
  }
  if (cmd === "lint") {
    const tracked = execFileSync("git", ["-C", root, "ls-files"], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
    const problems = lint(rules, tracked, exists);
    for (const p of problems) console.error(`check-areas: ${p}`);
    if (!problems.length) console.log(`check-areas: ${rules.length} rules, ${tracked.length} files: clean`);
    return problems.length ? 1 : 0;
  }
  console.error("usage: check-areas.mjs resolve|lint [--root DIR] [--areas DIR] [file…]");
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exit(main(process.argv.slice(2)));
