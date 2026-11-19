// Parsers for the browser-check manifest (scripts/loops/checks) and the file →
// check map (scripts/loops/check-areas). browser.sh reads both with awk; these
// are for tests that keep them in step.

const lines = (text) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

/** The manifest's checks, in suite order. Throws on a malformed line. */
export function parseManifest(text) {
  return lines(text).map((line) => {
    const [name, usual, cap, neverExits, e2e, ...rest] = line.split(/\s+/);
    const bad = (why) => new Error(`checks: ${why}: ${line}`);
    if (rest.length || e2e === undefined) throw bad("want 5 columns");
    if (!/^[a-z0-9-]+$/.test(name)) throw bad("bad check name");
    if (!/^\d+$/.test(usual) || !/^\d+$/.test(cap)) throw bad("usual and cap are whole seconds");
    if (!["yes", "no"].includes(neverExits) || !["yes", "no"].includes(e2e)) throw bad("flags are yes or no");
    return {
      name,
      usual: Number(usual),
      cap: Number(cap),
      neverExits: neverExits === "yes",
      e2e: e2e === "yes",
    };
  });
}

/** Every check named by a rule in check-areas (not `-`, `@suite` or `@self`). */
export function areaChecks(text) {
  const names = new Set();
  for (const line of lines(text)) {
    for (const word of line.split(/\s+/).slice(1)) {
      if (word !== "-" && !word.startsWith("@") && !word.startsWith("(")) names.add(word);
    }
  }
  return names;
}
