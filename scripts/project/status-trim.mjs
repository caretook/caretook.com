// Caretook's copy of the parts of the core's status-trim.mjs that Caretook uses:
// a plan's _Status_ size and the size past which `pnpm docs:budget` warns (the
// doc budget, doc-budget.mjs), and the next slice number (fixes-plans.test.mjs).
// A small pure module used on both sides is copied, not shared; the trim itself
// stays the core's (`risa status-trim`).

/** Past this many bytes, a plan's _Status_ draws a warning. */
export const STATUS_WARN_BYTES = 6 * 1024;

const STATUS = /^## Status[ \t]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m;

/** The _Status_ section's size in bytes (0 when it has none). */
export function statusBytes(/** @type {string} */ text) {
  const m = STATUS.exec(text);
  return m ? Buffer.byteLength(/** @type {string} */ (m[1])) : 0;
}

const SLICE_HEADING = /^#{2,4}\s+Slice\s+(\d+)\b/i;

/** "| a | b |" → ["a", "b"]. */
const cells = (/** @type {string} */ line) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

/** Every slice number the text names: slice headings and rows of slice tables. */
function sliceNumbers(/** @type {string} */ text) {
  const out = [];
  let inTable = false;
  for (const line of text.split("\n")) {
    const h = SLICE_HEADING.exec(line);
    if (h) out.push(Number(h[1]));
    if (!line.trim().startsWith("|")) {
      inTable = false;
      continue;
    }
    const c = cells(line);
    if (!inTable) inTable = /^slice$/i.test(c[0] ?? "");
    else if (/^\d+$/.test(c[0] ?? "")) out.push(Number(c[0]));
  }
  return out;
}

/** The next slice number: one past the highest in the plan and its history. */
export function nextSlice(/** @type {string} */ planText, historyText = "") {
  return Math.max(0, ...sliceNumbers(planText), ...sliceNumbers(historyText)) + 1;
}
