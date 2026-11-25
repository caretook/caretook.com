// Caretook's copy of the part of the core's status-trim.mjs that the doc budget
// (doc-budget.mjs) uses: a plan's _Status_ size and the size past which
// `pnpm docs:budget` warns. A small pure module used on both sides is copied,
// not shared; the trim itself stays the core's (`pnpm prd status-trim`).

/** Past this many bytes, a plan's _Status_ draws a warning. */
export const STATUS_WARN_BYTES = 6 * 1024;

const STATUS = /^## Status[ \t]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m;

/** The _Status_ section's size in bytes (0 when it has none). */
export function statusBytes(/** @type {string} */ text) {
  const m = STATUS.exec(text);
  return m ? Buffer.byteLength(/** @type {string} */ (m[1])) : 0;
}
