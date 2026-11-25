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
