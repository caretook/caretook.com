// What a Vitest run failed, read from its JSON report (check-body.sh uses it to
// rerun only those files and to name the step). Pure functions, plus a small CLI:
//   node check-failed.mjs <report.json>   the failed test files, one per line,
//                                         relative to the current directory
//   node check-failed.mjs --step <file>…  the step those files belong to
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

/** The step a mixed test run's failures count under: the cheapest kind that failed. */
export function stepOf(files) {
  if (files.some((f) => !/\.(int\.test\.ts|browser\.test\.tsx)$/.test(f))) return "unit";
  if (files.some((f) => f.endsWith(".int.test.ts"))) return "integration";
  return files.length ? "components" : "unit";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (args[0] === "--step") {
    console.log(stepOf(args.slice(1)));
  } else {
    let text = "";
    try {
      text = readFileSync(args[0], "utf8");
    } catch {
      // no report: the run died before writing one, so no file is named
    }
    for (const f of failedFiles(text, process.cwd())) console.log(f);
  }
}
