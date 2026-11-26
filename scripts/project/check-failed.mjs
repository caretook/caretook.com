// What a Vitest run failed, read from its JSON report (check-body.sh uses it to
// rerun only those files and to name the step) and its slowest files (for the
// time gate). Pure functions, plus a small CLI:
//   node check-failed.mjs <report.json>   the failed test files, one per line,
//                                         relative to the current directory
//   node check-failed.mjs --step <file>…  the step those files belong to
//   node check-failed.mjs --slowest <report.json>
//                                         its ten slowest files, `<seconds> <file>`
//                                         lines, slowest first
//   node check-failed.mjs --unhandled <log>
//                                         exits 0 when the run's output reports an
//                                         unhandled error, else 1
import { readFileSync } from "node:fs";
import { isAbsolute, relative } from "node:path";

/**
 * @param {string} text the JSON report; anything unreadable has no failed files
 * @param {string} cwd
 * @returns {string[]} sorted, relative to cwd
 */
export function failedFiles(text, cwd) {
  let report;
  try {
    report = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(report?.testResults)) return [];
  const names = report.testResults
    .filter((r) => r?.status === "failed" && typeof r.name === "string")
    .map((r) => (isAbsolute(r.name) ? relative(cwd, r.name) : r.name));
  return [...new Set(names)].sort();
}

/** How many slowest files a report gives. */
export const SLOWEST = 10;

/**
 * A report's slowest test files, by each file's start and end time.
 * @param {string} text the JSON report; anything unreadable has none
 * @param {string} cwd
 * @param {number} [n]
 * @returns {{ name: string, seconds: number }[]} slowest first, names relative to cwd
 */
export function slowestFiles(text, cwd, n = SLOWEST) {
  let report;
  try {
    report = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(report?.testResults)) return [];
  return report.testResults
    .filter(
      (r) =>
        typeof r?.name === "string" &&
        Number.isFinite(r.startTime) &&
        Number.isFinite(r.endTime) &&
        r.endTime >= r.startTime,
    )
    .map((r) => ({
      name: isAbsolute(r.name) ? relative(cwd, r.name) : r.name,
      seconds: Math.round((r.endTime - r.startTime) / 100) / 10,
    }))
    .sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name))
    .slice(0, n);
}

/**
 * Whether a Vitest run's output reports an unhandled error: only the runner's own
 * report line (`Vitest caught N unhandled error(s) during the test run`, or a
 * collection's `There were unhandled errors during test collection`), at a line's
 * start, colours stripped, so a test's title that says "unhandled error" (a `✓`
 * line, its file and describe first) never counts.
 * @param {string} text
 * @returns {boolean}
 */
export function unhandledError(text) {
  // eslint-disable-next-line no-control-regex -- the colour codes themselves
  const plain = text.replace(/\x1b\[[0-9;]*m/g, "");
  return /^(Vitest caught \d+ unhandled errors? during the test run|There were unhandled errors during test collection)/m.test(
    plain,
  );
}

/** The step a mixed test run's failures count under: the cheapest kind that failed. */
export function stepOf(files) {
  if (files.some((f) => !/\.(int\.test\.ts|browser\.test\.tsx)$/.test(f))) return "unit";
  if (files.some((f) => f.endsWith(".int.test.ts"))) return "integration";
  return files.length ? "components" : "unit";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const report = (file) => {
    try {
      return readFileSync(file, "utf8");
    } catch {
      return ""; // no report: the run died before writing one, so no file is named
    }
  };
  if (args[0] === "--step") {
    console.log(stepOf(args.slice(1)));
  } else if (args[0] === "--unhandled") {
    process.exitCode = unhandledError(report(args[1])) ? 0 : 1;
  } else if (args[0] === "--slowest") {
    for (const f of slowestFiles(report(args[1]), process.cwd())) console.log(`${f.seconds} ${f.name}`);
  } else {
    for (const f of failedFiles(report(args[0]), process.cwd())) console.log(f);
  }
}
