// A CI run's verdict: one small JSON file, version 1, uploaded as the `verdict`
// artifact and read on the Mac by `pnpm prd ci`. Pure except for the CLI at the
// bottom, and it imports only tiers.mjs: the verdict job runs with no install.
//
// The kinds, worst first: `brake` (static, build, or a test on the brake list
// still failing after its rerun), `infra` (a job that died before any test, or
// never ran), `file` (any other real failure), `flake` (passed on the rerun),
// `green`. Infra outranks file and flake: with a job missing, the rest is partial.
// A browser check is named by its spec's path, as a file with no test name: one
// that failed its rerun is a failure, one that passed it a flake, and one that
// never ran (the job's time ran out) infra. On `release` the three suite runs read
// as one (release.mjs), and the second zone only reports unless its setting is `block`.
//
//   node scripts/ci/verdict.mjs summarize <vitest.json>…   prints `failures=<json>`
//     for $GITHUB_OUTPUT: each report with its .rerun.json and .quarantine.json,
//     capped to fit a job output
//   node scripts/ci/verdict.mjs write <out.json>   from CI_NEEDS (toJSON(needs)),
//     CI_TIER, CI_COMMIT, CI_RUN_ID, the two lists and .ci-narrowed.json
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";

import { isBrake, isQuarantined, readLists } from "./lists.mjs";
import { BROWSER_RUNS, ZONE_JOBS, combineRepeats, summarizeZone } from "./release.mjs";
import { FORCED_FLAKE_FILE, NARROWED_FILE, jobsFor, narrowedJobs } from "./tiers.mjs";
import { SECOND_ZONE, SECOND_ZONE_MODE } from "./zones.mjs";

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
  if (!report?.testResults) return { reported: false, total: 0, files: [], tests: [], truncated: false };
  let total = 0;
  /** @type {string[]} */ const files = [];
  /** @type {{ file: string, name: string }[]} */ const tests = [];
  for (const result of report.testResults) {
    const file = relative(root, result.name);
    total += result.assertionResults?.length ?? 0;
    const failed = (result.assertionResults ?? []).filter((a) => a.status === "failed");
    if (result.status === "failed" || failed.length) files.push(file);
    for (const a of failed)
      tests.push({ file, name: (a.fullName || a.title || "(unnamed)").trim().slice(0, MAX_NAME) });
  }
  return {
    reported: true,
    total,
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
    total: summaries.reduce((sum, s) => sum + s.total, 0),
    files: files.slice(0, MAX_TESTS),
    tests: tests.slice(0, MAX_TESTS),
    truncated: summaries.some((s) => s.truncated) || files.length > MAX_TESTS || tests.length > MAX_TESTS,
  };
}

/**
 * What still fails after a report's rerun. A file counts as passed only when the
 * rerun's report shows it passed: a rerun that died proves nothing.
 * @param {ReturnType<typeof summarizeVitest>} first
 * @param {any} rerun the rerun's Vitest report, or null
 * @param {string} root
 */
export function stillFailing(first, rerun, root) {
  if (!rerun?.testResults) return { files: first.files, tests: first.tests };
  const results = new Map(rerun.testResults.map((/** @type {any} */ r) => [relative(root, r.name), r]));
  const passed = (/** @type {string} */ file) => {
    const r = /** @type {any} */ (results.get(file));
    return r?.status === "passed";
  };
  return {
    files: first.files.filter((f) => !passed(f)),
    tests: first.tests.filter((t) => {
      if (passed(t.file)) return false;
      const r = /** @type {any} */ (results.get(t.file));
      const after = r?.assertionResults?.find(
        (/** @type {any} */ a) => (a.fullName || a.title || "(unnamed)").trim().slice(0, MAX_NAME) === t.name,
      );
      return after?.status !== "passed";
    }),
  };
}

/**
 * The quarantined tests a quarantine step ran.
 * @param {any} report
 * @param {string} root
 */
export function quarantineResults(report, root) {
  /** @type {{ file: string, name: string, status: string }[]} */ const out = [];
  for (const result of report?.testResults ?? [])
    for (const a of result.assertionResults ?? [])
      if (a.status === "passed" || a.status === "failed")
        out.push({
          file: relative(root, result.name),
          name: (a.fullName || a.title || "(unnamed)").trim().slice(0, MAX_NAME),
          status: a.status,
        });
  return out.slice(0, MAX_TESTS);
}

/**
 * One job's output: its first reports, what still failed after each rerun (null
 * when nothing reran) and the quarantine step's results.
 * @param {string[]} paths
 * @param {string} root
 * @param {(path: string) => any} readReport null for a missing file
 */
export function summarizeJob(paths, root, readReport) {
  const firsts = paths.map((p) => summarizeVitest(readReport(p), root));
  const reruns = paths.map((p) => readReport(p.replace(/\.json$/, ".rerun.json")));
  const after = firsts.map((first, i) => stillFailing(first, reruns[i], root));
  return {
    ...mergeSummaries(firsts),
    rerun: reruns.some(Boolean)
      ? { files: after.flatMap((a) => a.files), tests: after.flatMap((a) => a.tests) }
      : null,
    quarantined: paths.flatMap((p) =>
      quarantineResults(readReport(p.replace(/\.json$/, ".quarantine.json")), root),
    ),
  };
}

const parseFailures = (/** @type {string | undefined} */ text) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/** Jobs that aren't test jobs: any failure past their setup is a brake. */
const CHECK_JOBS = new Set(["static", "build"]);

/**
 * @typedef {{ result?: string, outputs?: Record<string, string> }} NeededJob
 * @typedef {{ file: string, name: string, item?: string }} Listed
 * @param {{ commit: string, runId: string, tier: string, needs: Record<string, NeededJob>, brakes?: string[], quarantine?: Listed[], narrowed?: { target: string, files: string[] } | null, forcedFlake?: string | null, zoneMode?: string }} run
 */
export function buildVerdict({
  commit,
  runId,
  tier,
  needs,
  brakes = [],
  quarantine = [],
  narrowed = null,
  forcedFlake = null,
  zoneMode = SECOND_ZONE_MODE,
}) {
  const { ranTier, jobs: tierJobs } = jobsFor(tier);
  const entries = /** @type {import("./lists.mjs").QuarantineEntry[]} */ (quarantine);
  const release = ranTier === "release" && !narrowed;
  const secondZone = release
    ? summarizeZone(needs, { zone: SECOND_ZONE, mode: zoneMode, quarantine: entries })
    : null;
  const skipped = /** @type {string[]} */ ([
    ...(release ? BROWSER_RUNS.slice(1) : []),
    ...(release && zoneMode !== "block" ? ZONE_JOBS : []),
  ]);
  const jobs = (narrowed ? narrowedJobs(narrowed.files) : tierJobs).filter((j) => !skipped.includes(j));
  const read = release ? { ...needs, browser: combineRepeats(needs) } : needs;

  /** @type {Set<string>} */ const failedJobs = new Set();
  /** @type {string[]} */ const infraJobs = [];
  /** @type {string[]} */ const brakeJobs = [];
  /** @type {string[]} */ const files = [];
  /** @type {{ job: string, file: string, name: string }[]} */ const tests = [];
  /** @type {string[]} */ const afterFiles = [];
  /** @type {{ job: string, file: string, name: string }[]} */ const afterTests = [];
  /** @type {{ job: string, file: string, name: string | null, brake: boolean }[]} */ const flaky = [];
  /** @type {{ job: string, file: string, name: string, status: string }[]} */ const quarantined = [];
  let truncated = false;
  let reran = false;
  /** @type {string[]} */ const unnamedJobs = [];
  /** @type {{ check: string, result: string }[] | null} */ let browser = null;
  /** @type {string[]} */ const notRun = [];

  if (needs.plan?.result !== "success") {
    failedJobs.add("plan");
    infraJobs.push("plan");
  }

  for (const job of jobs) {
    const need = read[job];
    const summary = parseFailures(need?.outputs?.failures);
    if (need?.outputs?.failures && !summary) truncated = true;
    truncated ||= !!summary?.truncated;
    for (const q of summary?.quarantined ?? []) quarantined.push({ job, ...q });
    if (job === "browser" && Array.isArray(summary?.checks)) browser = summary.checks;

    const listed = (/** @type {{ file: string, name: string }} */ t) =>
      isQuarantined(entries, t.file, t.name);
    /** @type {{ file: string, name: string }[]} */ const before = summary?.tests ?? [];
    for (const t of before.filter(listed))
      quarantined.push({ job, file: t.file, name: t.name, status: "failed" });
    const beforeTests = before.filter((t) => !listed(t));
    // A file whose only failures are quarantined tests isn't a failure.
    const onlyListed = (/** @type {string} */ f) =>
      before.some((t) => t.file === f) && !beforeTests.some((t) => t.file === f);
    /** @type {string[]} */ const beforeFiles = (summary?.files ?? []).filter(
      (/** @type {string} */ f) => !onlyListed(f),
    );
    const hadQuarantined = before.length > beforeTests.length;

    files.push(...beforeFiles);
    tests.push(...beforeTests.map((t) => ({ job, ...t })));

    const rerun = summary?.rerun ?? null;
    reran ||= !!rerun;
    const stillTests = rerun
      ? beforeTests.filter((t) =>
          rerun.tests.some(
            (/** @type {{ file: string, name: string }} */ a) => a.file === t.file && a.name === t.name,
          ),
        )
      : beforeTests;
    const stillFiles = rerun ? beforeFiles.filter((f) => rerun.files.includes(f)) : beforeFiles;
    afterTests.push(...stillTests.map((t) => ({ job, ...t })));
    afterFiles.push(...stillFiles);

    if (rerun) {
      for (const t of beforeTests)
        if (!stillTests.includes(t))
          flaky.push({ job, file: t.file, name: t.name, brake: isBrake(t.file, brakes) });
      for (const f of beforeFiles)
        if (!stillFiles.includes(f) && !beforeTests.some((t) => t.file === f))
          flaky.push({ job, file: f, name: null, brake: isBrake(f, brakes) });
    }
    if (beforeFiles.length || beforeTests.length) failedJobs.add(job);

    if (need?.result === "success") continue;
    // Checks the job never reached prove nothing, whatever the others did.
    if (summary?.notRun?.length) {
      notRun.push(...summary.notRun);
      failedJobs.add(job);
      infraJobs.push(job);
      continue;
    }
    if (stillTests.length || stillFiles.length) continue;
    // The browser suite ran and failed with no check named: its report is missing.
    if (job === "browser" && need?.outputs?.started === "true") {
      failedJobs.add(job);
      unnamedJobs.push(job);
      continue;
    }
    if (CHECK_JOBS.has(job)) {
      failedJobs.add(job);
      if (need?.outputs?.started === "true") brakeJobs.push(job);
      else infraJobs.push(job);
      continue;
    }
    // Failed, but only on tests the quarantine covers.
    if (hadQuarantined && summary?.reported) continue;
    failedJobs.add(job);
    if (summary?.reported && summary.total > 0) unnamedJobs.push(job);
    else infraJobs.push(job);
  }

  const brakeTests = afterTests.filter((t) => isBrake(t.file, brakes));
  const brakeFiles = afterFiles.filter((f) => isBrake(f, brakes));
  const kind =
    brakeJobs.length || brakeTests.length || brakeFiles.length
      ? "brake"
      : infraJobs.length
        ? "infra"
        : afterTests.length || afterFiles.length || unnamedJobs.length
          ? "file"
          : flaky.length
            ? "flake"
            : "green";

  return {
    version: VERDICT_VERSION,
    commit,
    target: narrowed?.target ?? commit,
    runId,
    tier,
    ranTier,
    narrowed: !!narrowed,
    narrowedFiles: narrowed?.files ?? [],
    // A proof run's forced check: this verdict never passes a gate.
    forcedFlake,
    kind,
    failed: { jobs: [...failedJobs], files: [...new Set(files)], tests, truncated, unnamedJobs },
    afterRerun: reran ? { files: [...new Set(afterFiles)], tests: afterTests } : null,
    flaky,
    brake: { jobs: brakeJobs, tests: brakeTests, files: [...new Set(brakeFiles)] },
    infra: { jobs: infraJobs, notRun },
    // Each browser check by name: pass, flake, fail or not-run. Null with no browser report.
    browser,
    // The release tier's second zone: its mode, failing files and jobs that proved nothing.
    secondZone,
    quarantined,
    // What this commit skips: blame can't read a skipped test as passing.
    quarantineList: entries.map(({ file, name }) => ({ file, name })),
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

async function cli(/** @type {string[]} */ [command, path, ...more]) {
  if (command === "summarize" && path) {
    const readReport = (/** @type {string} */ p) => {
      if (!existsSync(p)) return null;
      try {
        return JSON.parse(readFileSync(p, "utf8"));
      } catch {
        return null;
      }
    };
    console.log(`failures=${JSON.stringify(summarizeJob([path, ...more], process.cwd(), readReport))}`);
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
      ...(await readLists()),
      narrowed: existsSync(NARROWED_FILE) ? JSON.parse(readFileSync(NARROWED_FILE, "utf8")) : null,
      forcedFlake: existsSync(FORCED_FLAKE_FILE)
        ? String(JSON.parse(readFileSync(FORCED_FLAKE_FILE, "utf8")).check)
        : null,
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
    await cli(process.argv.slice(2));
  } catch (e) {
    console.error(/** @type {Error} */ (e).message);
    process.exit(1);
  }
}
