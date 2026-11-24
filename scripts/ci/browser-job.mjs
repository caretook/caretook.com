#!/usr/bin/env node
// The browser suite of a CI job: `node scripts/ci/browser-job.mjs`, then
// `node scripts/ci/browser-job.mjs report` for $GITHUB_OUTPUT.
//
// Runs browser.sh --suite, then reruns once each check that failed and that the
// runner hasn't already retried, so no check gets a third try. A pass on the rerun,
// or the runner's FLAKY, is a flake: the job passes and the verdict names the check.
// Both passes share one time budget inside the job's limit; a check they never
// reach is `not-run`, which the verdict reads as infra.
//
// A proof run's throwaway commit carries .github/ci-force-flake.json (`pnpm prd ci run
// candidate --force-flake <check>`): that check's spec throws for the first pass
// and is restored for the rerun. Without the file nothing here changes a spec.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { FORCED_FLAKE_FILE, browserCheckFile } from "./tiers.mjs";

export const FIRST_RESULTS = "ci-results/browser.tsv";
export const RERUN_RESULTS = "ci-results/browser.rerun.tsv";
const MANIFEST = "scripts/loops/checks";
/** The job's 35 minutes less its setup (about 3) and a margin to report. */
export const BUDGET_S = 1740;
/** Too little left to start a rerun that could prove anything. */
const MIN_RERUN_S = 30;
const PASSED = new Set(["pass", "ended", "FLAKY"]);
/** Failures a rerun can answer; a MISSING spec stays missing. */
const RERUNNABLE = new Set(["FAIL", "TIMEOUT"]);
export const FORCED_LINE = 'throw new Error("forced failure for the CI proof run");\n';

/**
 * @typedef {{ check: string, verdict: string, retried: boolean }} CheckRun
 * @typedef {{ run: (args: string[], env: Record<string, string>) => number, readText: (path: string) => string | null, writeText: (path: string, text: string) => void, remove: (path: string) => void, log: (line: string) => void, now: () => number, root: string }} BrowserIo
 */

/** The suite's checks, in order: the manifest's `e2e yes` lines. */
export const suiteChecks = (/** @type {string} */ manifest) =>
  manifest
    .split("\n")
    .filter((line) => !line.startsWith("#"))
    .map((line) => line.trim().split(/\s+/))
    .filter((fields) => fields.length >= 4 && fields[3] === "yes")
    .map((fields) => /** @type {string} */ (fields[0]));

/**
 * browser.sh's result lines, by check.
 * @param {string | null} text
 * @returns {Map<string, CheckRun>}
 */
export function parseResults(text) {
  const out = new Map();
  for (const line of (text ?? "").split("\n")) {
    const [check, verdict, retried] = line.split("\t");
    if (check && verdict) out.set(check, { check, verdict, retried: retried === "1" });
  }
  return out;
}

/** The checks worth one rerun: failed, and not already retried by the runner. */
export const toRerun = (/** @type {Map<string, CheckRun>} */ first) =>
  [...first.values()].filter((r) => RERUNNABLE.has(r.verdict) && !r.retried).map((r) => r.check);

/**
 * The job's summary, in the shape the verdict reads: a check is a file with no
 * test name.
 * @param {string[]} expected
 * @param {Map<string, CheckRun>} first
 * @param {Map<string, CheckRun>} rerun
 */
export function summarizeBrowser(expected, first, rerun) {
  /** @type {string[]} */ const files = [];
  /** @type {string[]} */ const still = [];
  /** @type {string[]} */ const notRun = [];
  const checks = expected.map((check) => {
    const once = first.get(check);
    if (!once || once.verdict === "NOT-RUN") {
      notRun.push(check);
      return { check, result: "not-run" };
    }
    if (once.verdict === "pass" || once.verdict === "ended") return { check, result: "pass" };
    const file = browserCheckFile(check);
    files.push(file);
    if (once.verdict === "FLAKY" || PASSED.has(rerun.get(check)?.verdict ?? ""))
      return { check, result: "flake" };
    still.push(file);
    return { check, result: "fail" };
  });
  return {
    reported: first.size > 0,
    total: expected.length,
    files,
    tests: [],
    truncated: false,
    rerun: files.length ? { files: still, tests: [] } : null,
    quarantined: [],
    notRun,
    checks,
  };
}

/** The proof run's check, or null on every normal run. */
function forcedCheck(/** @type {BrowserIo} */ io, /** @type {string[]} */ expected) {
  const text = io.readText(FORCED_FLAKE_FILE);
  if (text === null) return null;
  const check = String(JSON.parse(text).check);
  if (!expected.includes(check)) throw new Error(`${FORCED_FLAKE_FILE}: ${check} isn't in the suite`);
  return check;
}

const readSummary = (/** @type {BrowserIo} */ io) =>
  summarizeBrowser(
    suiteChecks(io.readText(MANIFEST) ?? ""),
    parseResults(io.readText(FIRST_RESULTS)),
    parseResults(io.readText(RERUN_RESULTS)),
  );

/** @param {BrowserIo} io */
export function runBrowserJob(io) {
  const expected = suiteChecks(io.readText(MANIFEST) ?? "");
  if (!expected.length) throw new Error(`no suite in ${MANIFEST}`);
  const forced = forcedCheck(io, expected);
  const start = io.now();
  io.remove(FIRST_RESULTS);
  io.remove(RERUN_RESULTS);

  const spec = forced ? browserCheckFile(forced) : null;
  const original = spec ? io.readText(spec) : null;
  if (spec && original === null) throw new Error(`no spec for the forced check: ${spec}`);
  try {
    if (spec) {
      io.log(`proof run: ${forced} is forced to fail on the first pass`);
      io.writeText(spec, `${FORCED_LINE}${original}`);
    }
    // A forced failure must reach this job's rerun, not the runner's retry.
    io.run(["--suite", ...(spec ? ["--no-retry"] : [])], {
      CARETOOK_BROWSER_RESULTS: join(io.root, FIRST_RESULTS),
      CARETOOK_BROWSER_SUITE_CAP: String(BUDGET_S),
    });
  } finally {
    if (spec && original !== null) io.writeText(spec, original);
  }

  const failed = toRerun(parseResults(io.readText(FIRST_RESULTS)));
  const left = BUDGET_S - Math.floor((io.now() - start) / 1000);
  if (failed.length && left < MIN_RERUN_S) io.log(`${left}s left: not rerunning ${failed.join(", ")}`);
  else if (failed.length) {
    io.log(`rerunning ${failed.length} failed check(s) once: ${failed.join(", ")}`);
    io.run(["--suite", "--no-retry"], {
      CARETOOK_BROWSER_RESULTS: join(io.root, RERUN_RESULTS),
      CARETOOK_BROWSER_SUITE: failed.join(" "),
      CARETOOK_BROWSER_SUITE_CAP: String(left),
    });
  }

  const summary = readSummary(io);
  for (const { check, result } of summary.checks) if (result !== "pass") io.log(`${check}: ${result}`);
  return summary.rerun?.files.length || summary.notRun.length ? 1 : 0;
}

/** @returns {BrowserIo} */
const realIo = () => {
  const root = process.cwd();
  return {
    root,
    // An absolute path: the runner changes directory and then resolves itself from $0.
    run: (args, env) =>
      spawnSync("bash", [join(root, "scripts/loops/browser.sh"), ...args], {
        stdio: "inherit",
        env: { ...process.env, ...env },
      }).status ?? 1,
    readText: (path) => (existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : null),
    writeText: (path, text) => writeFileSync(join(root, path), text),
    remove: (path) => rmSync(join(root, path), { force: true }),
    log: (line) => console.log(`browser-job: ${line}`),
    now: () => Date.now(),
  };
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const io = realIo();
    if (process.argv[2] === "report") console.log(`failures=${JSON.stringify(readSummary(io))}`);
    else {
      mkdirSync(join(io.root, "ci-results"), { recursive: true });
      process.exit(runBrowserJob(io));
    }
  } catch (e) {
    console.error(`browser-job: ${/** @type {Error} */ (e).message}`);
    process.exit(1);
  }
}
