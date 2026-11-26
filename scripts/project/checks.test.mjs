// The browser-check manifest (scripts/project/checks) against the file → check
// map (check-areas.d/) and the checks on disk.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { areaChecks, parseManifest } from "./checks.mjs";

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

  it("names each check once, and each has its spec", () => {
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      const has = (file) => existsSync(new URL(`../browser-checks/${file}`, import.meta.url));
      expect(has(`${name}.spec.mjs`), `${name}.spec.mjs`).toBe(true);
    }
  });
});

describe("parseManifest", () => {
  it("reads the columns and skips comments", () => {
    expect(parseManifest("# check cap never-exits e2e\nfoo 30 yes no\n\n")).toEqual([
      { name: "foo", cap: 30, neverExits: true, e2e: false },
    ]);
  });

  it("refuses a malformed line", () => {
    expect(() => parseManifest("foo 30 yes")).toThrow(/4 columns/);
    expect(() => parseManifest("foo 10 30 yes no")).toThrow(/4 columns/);
    expect(() => parseManifest("foo thirty yes no")).toThrow(/whole seconds/);
    expect(() => parseManifest("foo 30 maybe no")).toThrow(/yes or no/);
  });
});

describe("areaChecks", () => {
  it("collects check names, not markers", () => {
    const text =
      "# a comment\n*.md  -\npackage.json @suite\nscripts/x/* @self\napps/a/* phase2 ui\napps/b/* ui";
    expect([...areaChecks(text)].sort()).toEqual(["phase2", "ui"]);
  });
});
