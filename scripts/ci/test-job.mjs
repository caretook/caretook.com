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
// CARETOOK_QUARANTINE=run, into <out>.quarantine.json, and always exits 0.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { pathToFileURL } from "node:url";

import { parseQuarantine } from "./lists.mjs";
import { NARROWED_FILE, fileGroup } from "./tiers.mjs";

export const MAX_RERUN_FILES = 20;

/**
 * @typedef {{ run: (args: string[], env: Record<string, string>) => number, readText: (path: string) => string | null, log: (line: string) => void, root: string }} JobIo
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

/** @param {string[]} args @param {JobIo} io */
export function runStep(args, io) {
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
  const code = io.run(first, {});
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
  if (narrowedFiles(io)) return 0;
  const group = stepGroup(args);
  const text = io.readText("scripts/ci/quarantine.txt") ?? "";
  const files = [...new Set(parseQuarantine(text).map((e) => e.file))].filter((f) => fileGroup(f) === group);
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
});

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const argv = process.argv.slice(2);
  const quarantine = argv.includes("--quarantine");
  const args = argv.filter((a) => a !== "--quarantine");
  process.exit(quarantine ? runQuarantine(args, realIo()) : runStep(args, realIo()));
}
