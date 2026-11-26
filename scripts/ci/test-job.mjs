#!/usr/bin/env node
// One test step of a CI job: `node scripts/ci/test-job.mjs <vitest args>`.
//
// Runs Vitest. When test files fail it reruns only those, once, in the same job,
// with CARETOOK_CI_RERUN=1, and writes <out>.rerun.json beside the report: exit 0
// if they pass (the verdict reads a flake). Past MAX_RERUN_FILES it doesn't rerun:
// that many failures aren't flakes, and a second pass could reach the job's limit.
//
// On a narrowed run (.ci-narrowed.json) it runs only the listed files this step owns.
//
// With --quarantine it runs the quarantined tests this step owns, under
// CARETOOK_QUARANTINE=run, into <out>.quarantine.json, and always exits 0. On a
// narrowed run, only those in its listed files: blame needs their result on dev.
//
// With --time-gate it times its first Vitest run (never the rerun, never the
// install) and judges it by the time gate (time-gate.mjs), the measure being its
// step group (unit or components), the slowest files read from its own report. It
// writes the result to <out>.time.json beside the report (the verdict's summary
// reads it), prints the gate's lines in the log and the job summary, and fails the
// step on an armed `fail` even when every test passed: the verdict reads that as
// its own kind, `time`. A narrowed run isn't timed: it runs a few files, never a gate.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { pathToFileURL } from "node:url";

import { timeGate } from "../loops/time-gate.mjs";
import { tierData } from "./tier-data.mjs";
import { parseQuarantine } from "./lists.mjs";
import { NARROWED_FILE, fileGroup } from "./tiers.mjs";

export const MAX_RERUN_FILES = 20;
/** The step groups the time gate judges, each its own measure. */
export const TIMED_GROUPS = ["unit", "components"];
export const TIME_GATE_FLAG = "--time-gate";

/**
 * @typedef {{ run: (args: string[], env: Record<string, string>) => number, readText: (path: string) => string | null, log: (line: string) => void, root: string,
 *   now?: () => number, gates?: () => Readonly<import("./tier-data.mjs").Gates>,
 *   write?: (path: string, text: string) => void, summary?: (text: string) => void }} JobIo
 *   now: milliseconds; gates: the time gates' data; write: a file; summary: the job summary
 */

/** Which group of test files a step's --project flags own. */
export function stepGroup(/** @type {string[]} */ args) {
  const projects = args.flatMap((a, i) => (args[i - 1] === "--project" ? [a] : []));
  if (projects.includes("web:components")) return "components";
  if (projects.includes("tooling:browser")) return "browser-tooling";
  if (projects.includes("integration")) return "integration";
  return "unit";
}

const OUTPUT = "--outputFile.json=";
const outputOf = (/** @type {string[]} */ args) => {
  const flag = args.find((a) => a.startsWith(OUTPUT));
  if (!flag) throw new Error(`test-job: needs ${OUTPUT}<path>`);
  return flag.slice(OUTPUT.length);
};
/** The same step writing elsewhere, whole (a rerun's files may sit in any shard). */
const variant = (/** @type {string[]} */ args, /** @type {string} */ suffix) =>
  args
    .filter((a) => !a.startsWith("--shard="))
    .map((a) => (a.startsWith(OUTPUT) ? a.replace(/\.json$/, `.${suffix}.json`) : a));

/** The failed files in a Vitest report, repo-relative; [] for a missing or broken one. */
export function failedFiles(/** @type {string | null} */ text, /** @type {string} */ root) {
  if (!text) return [];
  try {
    return (JSON.parse(text).testResults ?? [])
      .filter(
        (/** @type {{ status?: string, assertionResults?: { status: string }[] }} */ r) =>
          r.status === "failed" || r.assertionResults?.some((a) => a.status === "failed"),
      )
      .map((/** @type {{ name: string }} */ r) => relative(root, r.name));
  } catch {
    return [];
  }
}

function narrowedFiles(/** @type {JobIo} */ io) {
  const text = io.readText(NARROWED_FILE);
  return text ? /** @type {string[]} */ (JSON.parse(text).files) : null;
}

/** Each file's seconds in a Vitest report, repo-relative; [] for a missing or broken one. */
export function fileTimes(/** @type {string | null} */ text, /** @type {string} */ root) {
  if (!text) return [];
  try {
    return (JSON.parse(text).testResults ?? []).flatMap(
      (/** @type {{ name: string, startTime?: number, endTime?: number }} */ r) =>
        Number.isFinite(r.startTime) && Number.isFinite(r.endTime)
          ? [{ name: relative(root, r.name), seconds: (Number(r.endTime) - Number(r.startTime)) / 1000 }]
          : [],
    );
  } catch {
    return [];
  }
}

/** Where a step's time gate result goes: beside its report. */
export const timeFileOf = (/** @type {string} */ out) => out.replace(/\.json$/, ".time.json");

/**
 * Judge a timed first run and write its result; true on an armed fail.
 * @param {{ group: string, seconds: number, out: string }} step @param {JobIo} io
 */
function judgeTime({ group, seconds, out }, io) {
  let gates;
  try {
    gates = /** @type {NonNullable<JobIo["gates"]>} */ (io.gates)();
  } catch (e) {
    io.log(`time gate: can't read the gates' data, not judged (${e instanceof Error ? e.message : e})`);
    return false;
  }
  const limits = gates.measures[group];
  if (!limits) return false;
  const r = timeGate({
    measure: group,
    seconds,
    limits,
    slowest: fileTimes(io.readText(out), io.root),
  });
  const result = {
    measure: group,
    seconds: Math.round(seconds),
    ...limits,
    verdict: r.verdict,
    lines: r.lines,
  };
  io.write?.(timeFileOf(out), `${JSON.stringify(result, null, 2)}\n`);
  for (const line of r.lines) io.log(line);
  io.summary?.(
    `### Time gate: ${group}, ${result.seconds} s, ${r.verdict}\n\n\`\`\`\n${r.lines.join("\n")}\n\`\`\`\n`,
  );
  if (r.verdict !== "fail") return false;
  io.log(`time: the ${group} step took ${result.seconds} s, past its armed cutoff of ${limits.cutoff} s`);
  return true;
}

/** @param {string[]} argv @param {JobIo} io */
export function runStep(argv, io) {
  const timed = argv.includes(TIME_GATE_FLAG);
  const args = argv.filter((a) => a !== TIME_GATE_FLAG);
  const narrowed = narrowedFiles(io);
  const group = stepGroup(args);
  /** @type {string[]} */ let first = args;
  if (narrowed) {
    const own = narrowed.filter((f) => fileGroup(f) === group);
    if (!own.length) {
      io.log(`narrowed run: no ${group} files here`);
      return 0;
    }
    first = [...args.filter((a) => !a.startsWith("--shard=")), ...own];
  }
  const now = io.now ?? Date.now;
  const started = now();
  const code = io.run(first, {});
  const seconds = (now() - started) / 1000;
  const late =
    timed &&
    !narrowed &&
    TIMED_GROUPS.includes(group) &&
    judgeTime({ group, seconds, out: outputOf(args) }, io);
  const tests = testsCode(args, code, io);
  return tests === 0 && late ? 1 : tests;
}

/** The step's code from its tests alone: the first run's, or its one rerun's. */
function testsCode(/** @type {string[]} */ args, /** @type {number} */ code, /** @type {JobIo} */ io) {
  if (code === 0) return 0;
  const failed = failedFiles(io.readText(outputOf(args)), io.root);
  if (!failed.length) {
    io.log("no failed test file in the report: not rerunning");
    return code;
  }
  if (failed.length > MAX_RERUN_FILES) {
    io.log(`${failed.length} failed files, over ${MAX_RERUN_FILES}: not rerunning`);
    return code;
  }
  io.log(`rerunning ${failed.length} failed file(s) once`);
  return io.run([...variant(args, "rerun"), ...failed], { CARETOOK_CI_RERUN: "1" }) === 0 ? 0 : code || 1;
}

/** @param {string[]} args @param {JobIo} io */
export function runQuarantine(args, io) {
  const narrowed = narrowedFiles(io);
  const group = stepGroup(args);
  const text = io.readText("scripts/ci/quarantine.txt") ?? "";
  const files = [...new Set(parseQuarantine(text).map((e) => e.file))].filter(
    (f) => fileGroup(f) === group && (!narrowed || narrowed.includes(f)),
  );
  if (!files.length) {
    io.log(`no quarantined ${group} tests`);
    return 0;
  }
  io.run([...variant(args, "quarantine"), ...files], { CARETOOK_QUARANTINE: "run" });
  return 0;
}

/** @returns {JobIo} */
const realIo = () => ({
  run: (args, env) =>
    spawnSync("pnpm", ["exec", "vitest", "run", ...args], {
      stdio: "inherit",
      env: { ...process.env, ...env },
    }).status ?? 1,
  readText: (path) => (existsSync(path) ? readFileSync(path, "utf8") : null),
  log: (line) => console.log(`test-job: ${line}`),
  root: process.cwd(),
  now: Date.now,
  gates: () => tierData().GATES,
  write: (path, text) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  },
  summary: (text) => {
    const file = process.env.GITHUB_STEP_SUMMARY;
    if (file) appendFileSync(file, text);
  },
});

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const argv = process.argv.slice(2);
  const quarantine = argv.includes("--quarantine");
  const args = argv.filter((a) => a !== "--quarantine");
  process.exit(quarantine ? runQuarantine(args, realIo()) : runStep(args, realIo()));
}
