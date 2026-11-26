// The test shards, balanced by past durations (B-772). Vitest's own shard step deals
// files out by count, so one shard took most of the 30–60 s timeline and planner
// files and ran minutes longer than the others. The sequencer (shard-sequencer.mjs)
// hands each shard's files to `balanceShards`, whose seconds come from a committed
// table, component-durations.json: { "<project>": { "<file, from the project's root>": seconds } }.
// A file with no entry (a new one) goes by count. The table is refreshed from a CI
// run's component jobs, `node scripts/ci/shards.mjs refresh <run-id>`: it reads each
// shard's test step from the job log (the default reporter's file lines name the
// project, which the JSON report doesn't) and writes the table.
//
// Node's own modules only (and `gh` for the refresh).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const DURATIONS_FILE = new URL("./component-durations.json", import.meta.url);
/** The jobs whose logs refresh the table: the components tier's shards. */
export const SHARD_JOB = /^components-\d+$/;

/** @typedef {Record<string, Record<string, number>>} Durations */

/** The committed table; {} when it's missing or broken (every file then goes by count). */
export function readDurations(/** @type {URL | string} */ file = DURATIONS_FILE) {
  try {
    return /** @type {Durations} */ (JSON.parse(readFileSync(file, "utf8")));
  } catch {
    return {};
  }
}

/**
 * Deal items out to `count` shards. Items with seconds go first, longest first, each
 * to the shard with the least time so far (so the shards end at most the longest
 * item apart); items with none go after, each to the shard with the fewest items.
 * Ties go by key, then by the lower shard, so the same items give the same shards in
 * any order.
 * @param {{ key: string, seconds?: number }[]} items @param {number} count
 * @returns {string[][]} each shard's keys
 */
export function balanceShards(items, count) {
  if (!Number.isInteger(count) || count < 1) throw new Error(`shards: a count of at least 1, not ${count}`);
  const shards = Array.from({ length: count }, () => ({ keys: /** @type {string[]} */ ([]), seconds: 0 }));
  const byKey = (/** @type {{ key: string }} */ a, /** @type {{ key: string }} */ b) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  const timed = items
    .filter((i) => Number.isFinite(i.seconds) && Number(i.seconds) >= 0)
    .sort((a, b) => Number(b.seconds) - Number(a.seconds) || byKey(a, b));
  const untimed = items.filter((i) => !timed.includes(i)).sort(byKey);
  const lowest = (/** @type {(s: { keys: string[], seconds: number }) => number[]} */ rank) =>
    shards.reduce((best, s) => {
      const [a, b] = [rank(s), rank(best)];
      return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? s : best;
    });
  for (const item of timed) {
    const s = lowest((s) => [s.seconds, s.keys.length]);
    s.keys.push(item.key);
    s.seconds += Number(item.seconds);
  }
  for (const item of untimed) lowest((s) => [s.keys.length, s.seconds]).keys.push(item.key);
  return shards.map((s) => s.keys);
}

/** A spec's key: its project and its file from the project's root. */
export const shardKey = (/** @type {string} */ project, /** @type {string} */ file) => `${project}\t${file}`;

/** Its seconds in the table, or undefined. */
export const durationOf = (
  /** @type {Durations} */ table,
  /** @type {string} */ project,
  /** @type {string} */ file,
) => table[project]?.[file];

const ANSI = /\x1b\[[0-9;]*m/g;
// " ✓  web:components:ny (chromium)  app/…/x.browser.test.tsx (24 tests | 2 skipped) 31486ms"
// (a log line, after its timestamp); ❯ or × for a file with a failure.
const FILE_LINE =
  /^\s*[✓❯×↓]\s+\|?([\w:.-]+)\|?(?:\s+\(\w+\))?\s+(\S+\.test\.\w+)\s+\([^)]*\)\s+([\d.]+)(ms|s)\s*$/;
const STEP_START = /##\[group\]Run /;

/**
 * Each file's seconds in a component job's log: only its sharded test step (not the
 * quarantine step, which runs a few tests of other shards' files), and a file's
 * first line only (a rerun prints it again).
 * @param {string} text @returns {{ project: string, file: string, seconds: number }[]}
 */
export function parseShardLog(text) {
  /** @type {Map<string, { project: string, file: string, seconds: number }>} */
  const seen = new Map();
  let inStep = false;
  for (const raw of text.split("\n")) {
    const line = raw.replace(ANSI, "").replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z ?/, "");
    if (STEP_START.test(line)) {
      inStep = /--shard=/.test(line) && !/--quarantine/.test(line);
      continue;
    }
    if (!inStep) continue;
    const m = FILE_LINE.exec(line);
    if (!m) continue;
    const [, project, file, n, unit] = m;
    const key = shardKey(project, file);
    if (!seen.has(key)) seen.set(key, { project, file, seconds: Number(n) / (unit === "ms" ? 1000 : 1) });
  }
  return [...seen.values()];
}

/** The table from parsed lines: sorted, to a tenth of a second, so a refresh diffs cleanly. */
export function durationsTable(/** @type {{ project: string, file: string, seconds: number }[]} */ rows) {
  /** @type {Durations} */
  const table = {};
  for (const r of [...rows].sort((a, b) =>
    shardKey(a.project, a.file).localeCompare(shardKey(b.project, b.file)),
  ))
    (table[r.project] ??= {})[r.file] = Math.round(r.seconds * 10) / 10;
  return Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * The shard job ids of a run, from `gh run view --json jobs`.
 * @param {string} json @returns {{ name: string, id: string }[]}
 */
export function shardJobs(json) {
  const jobs = /** @type {{ jobs?: { name: string, databaseId: number }[] }} */ (JSON.parse(json)).jobs ?? [];
  return jobs.filter((j) => SHARD_JOB.test(j.name)).map((j) => ({ name: j.name, id: String(j.databaseId) }));
}

/**
 * Refresh the table from a run's shard jobs.
 * @param {string} runId
 * @param {{ gh: (args: string[]) => string, write: (text: string) => void, log: (line: string) => void }} io
 */
export function refresh(runId, io) {
  if (!/^\d+$/.test(runId)) throw new Error(`shards refresh: a run id, not ${JSON.stringify(runId)}`);
  const jobs = shardJobs(io.gh(["run", "view", runId, "--json", "jobs"]));
  if (!jobs.length) throw new Error(`shards refresh: run ${runId} has no components-N jobs`);
  const rows = jobs.flatMap((j) => {
    const found = parseShardLog(
      io.gh(["api", "--allow-escape-sequences", `repos/{owner}/{repo}/actions/jobs/${j.id}/logs`]),
    );
    io.log(
      `${j.name}: ${found.length} files, ${Math.round(found.reduce((s, r) => s + r.seconds, 0))} s in all`,
    );
    return found;
  });
  if (!rows.length) throw new Error(`shards refresh: no file lines in run ${runId}'s shard logs`);
  io.write(`${JSON.stringify(durationsTable(rows), null, 2)}\n`);
  io.log(`wrote ${rows.length} files' seconds to scripts/ci/component-durations.json`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [cmd, runId] = process.argv.slice(2);
  if (cmd !== "refresh" || !runId) {
    console.error("usage: node scripts/ci/shards.mjs refresh <run-id>");
    process.exit(2);
  }
  refresh(runId, {
    gh: (args) => execFileSync("gh", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }),
    write: (text) => writeFileSync(DURATIONS_FILE, text),
    log: (line) => console.log(line),
  });
}
