// The browser-check manifest (scripts/loops/checks) against the file → check
// map (check-areas.d/) and the checks on disk.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { areaChecks, leanBudget, leanCeiling, parseManifest } from "./checks.mjs";

const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8");
const manifest = parseManifest(read("./checks"));
const names = manifest.map((c) => c.name);

describe("the manifest", () => {
  it("lists every check named in check-areas.d/, and nothing else", () => {
    const rules = readdirSync(new URL("./check-areas.d/", import.meta.url))
      .map((name) => read(`./check-areas.d/${name}`))
      .join("\n");
    const areas = [...areaChecks(rules)].sort();
    expect([...names].sort()).toEqual(areas);
  });

  it("names each check once, and each has its file", () => {
    expect(new Set(names).size).toBe(names.length);
    for (const name of names)
      expect(existsSync(new URL(`../browser-checks/${name}.mjs`, import.meta.url)), name).toBe(true);
  });

  it("gives every check a cap above its usual time", () => {
    for (const c of manifest) expect(c.cap, c.name).toBeGreaterThan(c.usual);
  });

  it("keeps the lean set's usual seconds within its lean-ceiling", () => {
    const { total, ceiling } = leanBudget(read("./checks"));
    expect(total).toBeLessThanOrEqual(ceiling);
  });
});

describe("leanBudget", () => {
  // A lean set that exactly fills the hard limit: 300 s in all.
  const lean = [
    "phase2 10 120 no yes",
    "roundtrip 29 120 no yes",
    "live-notes 56 170 no yes",
    "app-shell 15 120 no yes",
    "layout-offline 19 300 yes yes",
    "sign-in 4 120 no yes",
    "first-sync 36 150 no yes",
    "signout-wipe 6 300 yes yes",
    "session-end 5 120 no yes",
    "invites 86 270 no yes",
    "ui 5 120 no yes",
    "marketing 29 120 no yes",
    "medications 163 490 no no",
  ];
  const withCeiling = (ceiling, rows = lean) => `# the budget\nlean-ceiling ${ceiling}\n${rows.join("\n")}\n`;

  it("passes at 300, counting only the e2e checks", () => {
    expect(leanBudget(withCeiling(300))).toEqual({ total: 300, ceiling: 300 });
  });

  it("fails when the lean total exceeds the ceiling, saying by how much", () => {
    expect(() => leanBudget(withCeiling(299))).toThrow(/add up to 300, over lean-ceiling 299 by 1/);
    const grown = lean.map((l) => l.replace("roundtrip 29", "roundtrip 44"));
    expect(() => leanBudget(withCeiling(300, grown))).toThrow(/add up to 315, over lean-ceiling 300 by 15/);
  });

  it("fails at a ceiling of 301: 300 s is the hard limit", () => {
    expect(() => leanBudget(withCeiling(301))).toThrow(/lean-ceiling 301 is over the hard limit of 300/);
  });

  it("wants exactly one ceiling, in whole seconds", () => {
    expect(() => leanCeiling(lean.join("\n"))).toThrow(/found 0/);
    expect(() => leanCeiling("lean-ceiling 1\nlean-ceiling 2")).toThrow(/found 2/);
    expect(() => leanCeiling("lean-ceiling five")).toThrow(/whole seconds/);
  });
});

describe("parseManifest", () => {
  it("reads the columns and skips comments", () => {
    expect(parseManifest("# check usual cap never-exits e2e\nfoo 10 30 yes no\n\n")).toEqual([
      { name: "foo", usual: 10, cap: 30, neverExits: true, e2e: false },
    ]);
  });

  it("refuses a malformed line", () => {
    expect(() => parseManifest("foo 10 30 yes")).toThrow(/5 columns/);
    expect(() => parseManifest("foo ten 30 yes no")).toThrow(/whole seconds/);
    expect(() => parseManifest("foo 10 30 maybe no")).toThrow(/yes or no/);
  });
});

describe("areaChecks", () => {
  it("collects check names, not markers", () => {
    const text =
      "# a comment\n*.md  -\npackage.json @suite\nscripts/x/* @self\napps/a/* phase2 ui\napps/b/* ui";
    expect([...areaChecks(text)].sort()).toEqual(["phase2", "ui"]);
  });
});
