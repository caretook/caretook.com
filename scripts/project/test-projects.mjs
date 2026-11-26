// The tooling tests' Vitest projects, by owner (vitest.config.ts), and the check
// that holds them to it. Pure: the manifest's text, the tracked test files and
// what `vitest list` printed in, the misplaced files out. Its test does the reading.

/** Caretook's tooling projects (`pnpm test:project`) and the core's. */
export const TOOLING_PROJECTS = {
  project: ["project:unit", "project:tooling"],
  core: ["core:unit", "tooling:unit", "tooling:browser"],
};

/**
 * Each manifest file's owner: `<path> core|project` lines, `#` comments.
 * @param {string} text
 * @returns {Map<string, string>}
 */
export const parseOwners = (text) =>
  new Map(
    text
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"))
      .map((line) => /** @type {[string, string]} */ (line.split(" "))),
  );

/**
 * The tests not in exactly one tooling project of their owner's: a file the
 * manifest doesn't name is the project's. Also any listed file not tracked.
 * @param {string[]} tracked the test files that must be in a tooling project
 * @param {Map<string, string[]>} byFile each listed file's tooling projects
 * @param {Map<string, string>} owners from parseOwners
 * @returns {string[]} one line per misplaced file
 */
export function misplaced(tracked, byFile, owners) {
  const wrong = [];
  for (const file of tracked) {
    const projects = byFile.get(file) ?? [];
    const owner = owners.get(file) ?? "project";
    const own = owner === "core" ? TOOLING_PROJECTS.core : TOOLING_PROJECTS.project;
    if (projects.length !== 1 || !own.includes(/** @type {string} */ (projects[0])))
      wrong.push(`${file} (${owner}): ${projects.join(", ") || "in no tooling project"}`);
  }
  const known = new Set(tracked);
  for (const file of byFile.keys())
    if (!known.has(file)) wrong.push(`${file}: listed, but not a tracked test`);
  return wrong;
}

/**
 * The guards a quick check must always run: tests that read source by path, so
 * `vitest --changed` can't select them (B-370). A new synced table or stream
 * column passes the check with its guard never run otherwise.
 */
export const QUICK_GUARDS = [
  "scripts/project/sync-matrix.test.mjs",
  "packages/data/src/db/roles/rolesSql.test.ts",
];

/**
 * The Vitest projects every slice and quick check runs: check-body.sh's `unit=(…)` line.
 * @param {string} body check-body.sh's text
 * @returns {string[]}
 */
export function quickProjects(body) {
  const line = /^unit=\((.*)\)$/m.exec(body);
  if (!line) throw new Error("check-body.sh: no unit=(…) line");
  return [...(line[1] ?? "").matchAll(/--project\s+(\S+)/g)].map((m) => String(m[1]));
}

/**
 * The guards outside every project a quick check runs, one line each.
 * @param {string[]} guards the guard files
 * @param {Map<string, string[]>} byFile each listed file's projects
 * @param {string[]} projects the quick check's projects
 * @returns {string[]}
 */
export function guardsOutside(guards, byFile, projects) {
  return guards.flatMap((file) => {
    const in_ = byFile.get(file) ?? [];
    return in_.some((p) => projects.includes(p))
      ? []
      : [`${file}: in ${in_.join(", ") || "no project"}, none of which a quick check runs`];
  });
}
