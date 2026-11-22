// A CI run's verdict: one small JSON file, version 1, uploaded as the `verdict`
// artifact and read on the Mac by `pnpm prd ci`. Pure except for the CLI at the
// bottom, and it imports only tiers.mjs: the verdict job runs with no install.
//
// This slice writes two kinds: `green` (every job the tier ran passed) and
// `file` (any other result). The other kinds come with the rerun and the lists.
//
//   node scripts/ci/verdict.mjs summarize <vitest.json>…   prints `failures=<json>`
//     for $GITHUB_OUTPUT: the failed files and tests, capped to fit a job output
//   node scripts/ci/verdict.mjs write <out.json>   from CI_NEEDS (toJSON(needs)),
//     CI_TIER, CI_COMMIT and CI_RUN_ID
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";

import { jobsFor } from "./tiers.mjs";

export const VERDICT_VERSION = 1;
/** Kept in a job output: GitHub limits them, and the verdict needs names, not logs. */
export const MAX_TESTS = 100;
const MAX_NAME = 300;

/**
 * The failed files and tests in a Vitest JSON report. A file that failed with
 * no failed test (an import error) is still listed.
 * @param {{ testResults?: { name: string, status?: string, assertionResults?: { status: string, fullName?: string, title?: string }[] }[] } | null} report
 * @param {string} root paths are made relative to it
 */
export function summarizeVitest(report, root) {
  if (!report?.testResults) return { reported: false, files: [], tests: [], truncated: false };
  /** @type {string[]} */ const files = [];
  /** @type {{ file: string, name: string }[]} */ const tests = [];
  for (const result of report.testResults) {
    const file = relative(root, result.name);
    const failed = (result.assertionResults ?? []).filter((a) => a.status === "failed");
    if (result.status === "failed" || failed.length) files.push(file);
    for (const a of failed)
      tests.push({ file, name: (a.fullName || a.title || "(unnamed)").trim().slice(0, MAX_NAME) });
  }
  return {
    reported: true,
    files: files.slice(0, MAX_TESTS),
    tests: tests.slice(0, MAX_TESTS),
    truncated: files.length > MAX_TESTS || tests.length > MAX_TESTS,
  };
}

/**
 * One job's reports as one summary. A missing report leaves it unreported.
 * @param {ReturnType<typeof summarizeVitest>[]} summaries
 */
export function mergeSummaries(summaries) {
  const files = summaries.flatMap((s) => s.files);
  const tests = summaries.flatMap((s) => s.tests);
  return {
    reported: summaries.every((s) => s.reported),
    files: files.slice(0, MAX_TESTS),
    tests: tests.slice(0, MAX_TESTS),
    truncated: summaries.some((s) => s.truncated) || files.length > MAX_TESTS || tests.length > MAX_TESTS,
  };
}

/**
 * @typedef {{ result?: string, outputs?: Record<string, string> }} NeededJob
 * @param {{ commit: string, runId: string, tier: string, needs: Record<string, NeededJob> }} run
 */
export function buildVerdict({ commit, runId, tier, needs }) {
  const { jobs, ranTier } = jobsFor(tier);
  const failedJobs = jobs.filter((job) => needs[job]?.result !== "success");
  if (needs.plan?.result !== "success") failedJobs.unshift("plan");
  /** @type {string[]} */ const files = [];
  /** @type {{ job: string, file: string, name: string }[]} */ const tests = [];
  let truncated = false;
  for (const job of jobs) {
    const text = needs[job]?.outputs?.failures;
    if (!text) continue;
    try {
      const summary = JSON.parse(text);
      files.push(...summary.files);
      tests.push(...summary.tests.map((/** @type {{ file: string, name: string }} */ t) => ({ job, ...t })));
      truncated ||= !!summary.truncated;
    } catch {
      truncated = true;
    }
  }
  return {
    version: VERDICT_VERSION,
    commit,
    target: commit,
    runId,
    tier,
    ranTier,
    narrowed: false,
    narrowedFiles: [],
    kind: failedJobs.length ? "file" : "green",
    failed: { jobs: failedJobs, files: [...new Set(files)], tests, truncated },
    afterRerun: null,
  };
}

/** @param {unknown} v */
export function isVerdict(v) {
  const o = /** @type {Record<string, unknown> | null} */ (v);
  return (
    !!o &&
    o.version === VERDICT_VERSION &&
    typeof o.commit === "string" &&
    typeof o.tier === "string" &&
    typeof o.kind === "string"
  );
}

function cli(/** @type {string[]} */ [command, path, ...more]) {
  if (command === "summarize" && path) {
    const summaries = [path, ...more].map((p) =>
      summarizeVitest(existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null, process.cwd()),
    );
    console.log(`failures=${JSON.stringify(mergeSummaries(summaries))}`);
    return;
  }
  if (command === "write" && path) {
    const { CI_NEEDS, CI_TIER, CI_COMMIT, CI_RUN_ID } = process.env;
    if (!CI_TIER || !CI_COMMIT || !CI_RUN_ID) throw new Error("CI_TIER, CI_COMMIT and CI_RUN_ID are needed");
    const verdict = buildVerdict({
      commit: CI_COMMIT,
      runId: CI_RUN_ID,
      tier: CI_TIER,
      needs: JSON.parse(CI_NEEDS || "{}"),
    });
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(verdict, null, 2)}\n`);
    console.log(`verdict: ${verdict.kind} (${verdict.tier})`);
    return;
  }
  throw new Error("usage: verdict.mjs summarize <vitest.json>… | write <out.json>");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    cli(process.argv.slice(2));
  } catch (e) {
    console.error(/** @type {Error} */ (e).message);
    process.exit(1);
  }
}
