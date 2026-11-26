// Caretook's own read of its project config (risa.json at a repo's root), for
// the scripts in this folder: they run with no core present (GitHub CI, a copy
// without the tool), so they never use the core's loader. A plain JSON read, no
// schema: the core's loader checks the file's shape. `node risa.mjs tool prd` prints
// the tool command's name here, for a shell script's hint.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The parsed risa.json at `root`, or null when there is none.
 * @param {string} root
 * @returns {any}
 */
export function readRisa(root) {
  const path = join(root, "risa.json");
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

/**
 * What the tool's own command NAME (prd, backlog) is called in the repo at `root`
 * (risa.json's tool.NAME: `pnpm prd` here, `risa` after the move), for a hint that names
 * it; the bare NAME when the config doesn't say.
 * @param {string} root
 * @param {"prd" | "backlog"} name
 * @returns {string}
 */
export function toolCommand(root, name) {
  const value = readRisa(root)?.tool?.[name];
  return typeof value === "string" && value ? value : name;
}

/** This repo's root: two folders up from this file. */
export const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/$/, "");

const isMain = () => {
  try {
    return realpathSync(process.argv[1] ?? "") === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
};

// node risa.mjs tool <prd|backlog> [root]: the name, for a shell script's hint.
if (isMain()) {
  const [what, name, root = REPO_ROOT] = process.argv.slice(2);
  if (what !== "tool" || (name !== "prd" && name !== "backlog")) {
    process.stderr.write("usage: risa.mjs tool <prd|backlog> [root]\n");
    process.exit(2);
  }
  process.stdout.write(`${toolCommand(root, name)}\n`);
}
