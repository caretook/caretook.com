// Parsers for the browser-check manifest (scripts/loops/checks) and the file →
// check map (scripts/loops/check-areas.d/). browser.sh reads the manifest with awk
// and the map through check-areas.mjs; these are for tests that keep them in step.

const lines = (text) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

const CEILING = /^lean-ceiling(\s|$)/;

/** The manifest's checks, in suite order (not its `lean-ceiling` line). Throws on a malformed line. */
export function parseManifest(text) {
  return lines(text)
    .filter((line) => !CEILING.test(line))
    .map((line) => {
      const [name, usual, cap, neverExits, e2e, ...rest] = line.split(/\s+/);
      const bad = (why) => new Error(`checks: ${why}: ${line}`);
      if (rest.length || e2e === undefined) throw bad("want 5 columns");
      if (!/^[a-z0-9-]+$/.test(name)) throw bad("bad check name");
      if (!/^\d+$/.test(usual) || !/^\d+$/.test(cap)) throw bad("usual and cap are whole seconds");
      if (!["yes", "no"].includes(neverExits) || !["yes", "no"].includes(e2e))
        throw bad("flags are yes or no");
      return {
        name,
        usual: Number(usual),
        cap: Number(cap),
        neverExits: neverExits === "yes",
        e2e: e2e === "yes",
      };
    });
}

/** The manifest's `lean-ceiling <seconds>`. Throws unless there is exactly one, in whole seconds. */
export function leanCeiling(text) {
  const found = lines(text).filter((line) => CEILING.test(line));
  if (found.length !== 1) throw new Error(`checks: want one lean-ceiling line, found ${found.length}`);
  const [, seconds, ...rest] = found[0].split(/\s+/);
  if (rest.length || !/^\d+$/.test(seconds ?? ""))
    throw new Error(`checks: lean-ceiling takes whole seconds: ${found[0]}`);
  return Number(seconds);
}

/** The most the lean set may take, in seconds. The ceiling can go down, never above this. */
export const LEAN_LIMIT = 300;

/**
 * The lean set's budget: the e2e checks' usual seconds against the ceiling.
 * Throws when the total is over it, saying by how much.
 */
export function leanBudget(text) {
  const ceiling = leanCeiling(text);
  if (ceiling > LEAN_LIMIT)
    throw new Error(`checks: lean-ceiling ${ceiling} is over the hard limit of ${LEAN_LIMIT} s`);
  const lean = parseManifest(text).filter((c) => c.e2e);
  const total = lean.reduce((sum, c) => sum + c.usual, 0);
  if (total > ceiling)
    throw new Error(
      `checks: the lean set's usual seconds add up to ${total}, over lean-ceiling ${ceiling} by ${total - ceiling} ` +
        `(${lean.map((c) => `${c.name} ${c.usual}`).join(", ")}). Shrink a lean check; only the user raises the ceiling.`,
    );
  return { total, ceiling };
}

/** Every check named by a rule in check-areas.d/ text (not `-`, `@suite` or `@self`). */
export function areaChecks(text) {
  const names = new Set();
  for (const line of lines(text)) {
    for (const word of line.split(/\s+/).slice(1)) {
      if (word !== "-" && !word.startsWith("@") && !word.startsWith("(")) names.add(word);
    }
  }
  return names;
}
