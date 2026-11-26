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

/**
 * The test titles a file declares (`describe`, `it`, `test`, with any modifiers),
 * each as a pattern (an `it.each` table's title too): a placeholder (`%s`, `$name`) or a template's
 * `${…}` matches any text. A plain text search, not a parse.
 * @param {string} source
 */
export function testTitles(source) {
  const call = /(?:\b(?:describe|it|test)(?:\.\w+)*\(|\]\s*\)\()\s*(["'`])((?:\\.|(?!\1).)*?)\1/gs;
  const escape = (/** @type {string} */ s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...source.matchAll(call)].map(([, , title = ""]) =>
    title
      .split(/(\$\{[^}]*\}|%[sdifjoO#%]|\$[\w.]+)/)
      .map((part, i) => (i % 2 ? ".+?" : escape(part.replace(/\\(.)/g, "$1"))))
      .join(""),
  );
}

/**
 * Whether a full test name (its suites' titles and its own, joined by spaces)
 * can be built from the titles a file declares.
 * @param {string} name
 * @param {string} source the test file's text
 */
export function namesTest(name, source) {
  const titles = testTitles(source).filter(Boolean);
  if (!titles.length) return false;
  const one = `(?:${titles.join("|")})`;
  return new RegExp(`^${one}(?: ${one})*$`, "s").test(name);
}

/**
 * The entries of both lists that name nothing: a brake glob that matches no test
 * file, and a quarantine entry whose file is gone or names no such test.
 * @param {{ brakes: string[], quarantine: QuarantineEntry[] }} lists
 * @param {string[]} files the repo's test files, repo-relative
 * @param {(file: string) => string} read a test file's text
 */
export function staleEntries({ brakes, quarantine }, files, read) {
  const have = new Set(files);
  return [
    ...brakes.filter((glob) => !files.some((f) => isBrake(f, [glob]))).map((glob) => `brake: ${glob}`),
    ...quarantine
      .filter((e) => !have.has(e.file) || !namesTest(e.name, read(e.file)))
      .map((e) => `quarantine: ${e.file}\t${e.name}\t${e.item}${have.has(e.file) ? "" : " (no such file)"}`),
  ];
}

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
