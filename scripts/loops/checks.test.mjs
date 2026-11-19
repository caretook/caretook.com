// The browser-check manifest (scripts/loops/checks) against the file → check
// map (check-areas) and the checks on disk.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { areaChecks, parseManifest } from "./checks.mjs";

const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8");
const manifest = parseManifest(read("./checks"));
const names = manifest.map((c) => c.name);

describe("the manifest", () => {
  it("lists every check named in check-areas, and nothing else", () => {
    const areas = [...areaChecks(read("./check-areas"))].sort();
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
