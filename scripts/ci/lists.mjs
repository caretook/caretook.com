// The two committed lists beside the workflow: the brake list (brake-list.txt)
// and the quarantine (quarantine.txt), at risa.json's paths.brakeList and
// paths.quarantine. Caretook's copy of the parser; the core keeps its own. The
// parsers are pure and browser-safe, since the Vitest setup shares isQuarantined;
// only readLists touches the disk, and it loads node:fs on demand. Imports nothing
// else: the verdict job runs with no install.

const COMMENT = /^\s*(#|$)/;

/**
 * The list's globs. A `check:<name>` line is a browser check, read as its spec's
 * path: that is how a verdict names a check.
 * @param {string} text
 */
export const parseBrakeList = (text) =>
  text
    .split("\n")
    .filter((line) => !COMMENT.test(line))
    .map((line) => line.trim().replace(/^check:(.+)$/, "scripts/browser-checks/$1.spec.mjs"));

/**
 * A glob as a regular expression: `*` stays inside a directory, `**` crosses them.
 * @param {string} glob
 */
export function globToRegExp(glob) {
  const body = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\/|\*\*|\*/g, (m) => (m === "**/" ? "(?:.*/)?" : m === "**" ? ".*" : "[^/]*"));
  return new RegExp(`^${body}$`);
}

/**
 * @param {string} file repo-relative
 * @param {string[]} patterns
 */
export const isBrake = (file, patterns) => patterns.some((p) => globToRegExp(p).test(file));

/**
 * @typedef {{ file: string, name: string, item: string }} QuarantineEntry
 * @param {string} text
 * @returns {QuarantineEntry[]}
 */
export function parseQuarantine(text) {
  return text
    .split("\n")
    .filter((line) => !COMMENT.test(line))
    .map((line) => {
      const fields = line.split("\t");
      const [file, name, item] = fields;
      if (fields.length !== 3 || !file || !name || !/^B-\d+$/.test(item ?? ""))
        throw new Error(`quarantine: a line needs <file><TAB><test name><TAB><B-n>: ${line}`);
      return { file, name, item: /** @type {string} */ (item) };
    });
}

/**
 * @param {QuarantineEntry[]} entries
 * @param {string} file repo-relative, or an absolute path ending in it
 * @param {string} name the test's full name
 */
export const isQuarantined = (entries, file, name) =>
  entries.some((e) => e.name === name && (file === e.file || file.endsWith(`/${e.file}`)));

/**
 * Whether the Vitest setup skips a test: a listed one by default, and under
 * CARETOOK_QUARANTINE=run every test but the listed ones.
 * @param {QuarantineEntry[]} entries
 * @param {string} file
 * @param {string} name
 * @param {string | undefined} mode
 */
export const skipsTest = (entries, file, name, mode) =>
  isQuarantined(entries, file, name) !== (mode === "run");

/** The quarantine mode of this run: "run" in a CI quarantine step, else "". CI's env leaves it unset. */
export const quarantineMode = (env = process.env) => env.CARETOOK_QUARANTINE ?? "";

/** Both lists, from the repo at `root`. */
export async function readLists(root = process.cwd()) {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const read = (/** @type {string} */ path) => readFileSync(join(root, path), "utf8");
  return {
    brakes: parseBrakeList(read("scripts/ci/brake-list.txt")),
    quarantine: parseQuarantine(read("scripts/ci/quarantine.txt")),
  };
}
