// Caretook's own read of its project config (risa.json at a repo's root), for
// the scripts in this folder: they run with no core present (GitHub CI, a copy
// without the tool), so they never use the core's loader. A plain JSON read, no
// schema: the core's loader checks the file's shape.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The parsed risa.json at `root`, or null when there is none.
 * @param {string} root
 * @returns {any}
 */
export function readRisa(root) {
  const path = join(root, "risa.json");
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}
