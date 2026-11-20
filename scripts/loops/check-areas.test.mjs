// The check-areas resolver (check-areas.mjs): most specific wins across rule
// files, the markers, the built-ins, and the lint over the real tree.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  UNMAPPED_DEFAULT,
  globToRegExp,
  lint,
  loadRules,
  parseRules,
  resolveFile,
  specificity,
} from "./check-areas.mjs";

const CLI = new URL("./check-areas.mjs", import.meta.url).pathname;
const ROOT = new URL("../..", import.meta.url).pathname;

// Two area files; neither's order nor line order matters.
const rules = [
  ...parseRules(
    `# the broad rules come first here, and still lose
apps/web/app/routes/*            phase2
apps/web/app/routes/app/*        roundtrip
scripts/browser-checks/*         @self
package.json                     @suite
`,
    "_global",
  ),
  ...parseRules(
    `apps/web/app/routes/app/groups/timeline/*  -
apps/web/app/routes/app/groups/timeline/new/* roundtrip
apps/web/app/routes/app/groups/timeline/Vital*  roundtrip live-notes
apps/web/app/routes/app/groups/timeline/V*l*.tsx  ui
`,
    "timeline",
  ),
];
const none = () => false;
const checks = (file, exists = none, rs = rules) => resolveFile(file, rs, exists).checks;

describe("globs", () => {
  it("match like bash's [[ == ]]: * crosses /, ? is one character, [...] a class", () => {
    expect(globToRegExp("apps/*").test("apps/web/app/x.ts")).toBe(true);
    expect(globToRegExp("*.md").test("docs/domain/a.md")).toBe(true);
    expect(globToRegExp("a?c").test("abc")).toBe(true);
    expect(globToRegExp("a?c").test("ac")).toBe(false);
    expect(globToRegExp("v[0-9].ts").test("v3.ts")).toBe(true);
    expect(globToRegExp("v[!0-9].ts").test("v3.ts")).toBe(false);
    expect(globToRegExp("a.b").test("aXb")).toBe(false);
  });

  it("measure specificity by literal prefix, then wildcards, then length", () => {
    expect(specificity("apps/web/*")).toEqual({ prefix: 9, wildcards: 1, length: 10 });
    expect(specificity("package.json")).toEqual({ prefix: 12, wildcards: 0, length: 12 });
    expect(specificity("*.md")).toEqual({ prefix: 0, wildcards: 1, length: 4 });
  });
});

describe("most specific wins", () => {
  it("picks the longest literal prefix across files, whatever their order", () => {
    expect(checks("apps/web/app/routes/web/x.tsx")).toBe("phase2");
    expect(checks("apps/web/app/routes/app/home/x.tsx")).toBe("roundtrip");
    expect(checks("apps/web/app/routes/app/groups/timeline/Row.tsx")).toBe("-");
    expect(checks("apps/web/app/routes/app/groups/timeline/new/route.tsx")).toBe("roundtrip");
    expect(checks("apps/web/app/routes/app/groups/timeline/new/route.tsx", none, [...rules].reverse())).toBe(
      "roundtrip",
    );
  });

  it("breaks an equal prefix by fewer wildcards, then by the longer glob", () => {
    // Vital* (1 wildcard) beats V*l*.tsx (2) for VitalCard.tsx.
    expect(checks("apps/web/app/routes/app/groups/timeline/VitalCard.tsx")).toBe("roundtrip live-notes");
    const byLength = parseRules("src/a*  one\nsrc/a*.ts  two\n");
    expect(checks("src/abc.ts", none, byLength)).toBe("two");
  });

  it("reports a tie it can't break, naming the rules (the first still answers)", () => {
    // Same prefix (lib/), one wildcard each, same length: nothing breaks it.
    const tied = [...parseRules("lib/*.ts  one\n", "area-a"), ...parseRules("lib/?.ts  two\n", "area-b")];
    const r = resolveFile("lib/x.ts", tied, none);
    expect(r.tie?.map((x) => `${x.source} ${x.glob}`)).toEqual(["area-a lib/*.ts", "area-b lib/?.ts"]);
    expect(r.checks).toBe("one");
    // A longer prefix is no tie.
    const prefixed = [...parseRules("lib/*.ts  one\n", "x"), ...parseRules("lib/a*s  two\n", "y")];
    expect(resolveFile("lib/a.ts", prefixed, none)).toMatchObject({ checks: "two", tie: undefined });
  });
});

describe("markers", () => {
  it("passes - and @suite through", () => {
    expect(checks("package.json")).toBe("@suite");
    expect(checks("apps/web/app/routes/app/groups/timeline/Row.tsx")).toBe("-");
  });

  it("runs a check file itself (@self), needs nothing for one the change deleted, or for a non-check", () => {
    const present = (p) => p === "scripts/browser-checks/phase2.mjs";
    expect(checks("scripts/browser-checks/phase2.mjs", present)).toBe("phase2");
    expect(checks("scripts/browser-checks/phase2.mjs", none)).toBe("- (deleted)");
    expect(checks("scripts/browser-checks/notes.txt", present)).toBe("-");
  });
});

describe("the built-ins", () => {
  it("needs no check for a test file, whatever folder rule matches it", () => {
    expect(checks("apps/web/app/routes/app/home/home.browser.test.tsx")).toBe("-");
    expect(checks("apps/web/app/routes/web/meta.test.ts")).toBe("-");
    expect(checks("scripts/browser-checks/sync-matrix.test.mjs")).toBe("-");
  });

  it("needs no check for a lib module with a sibling unit test", () => {
    const tested = (p) => p === "apps/web/app/lib/medications/doses.test.ts";
    expect(checks("apps/web/app/lib/medications/doses.ts", tested)).toBe("- (unit-tested)");
    expect(checks("apps/web/app/lib/medications/other.ts", tested)).toBe(`UNMAPPED ${UNMAPPED_DEFAULT}`);
  });

  it("doesn't let a unit test cover a device query (.sync.ts, or under lib/sync/)", () => {
    const tested = (p) =>
      p === "apps/web/app/lib/medications/medications.sync.test.ts" ||
      p === "apps/web/app/lib/sync/x.test.ts";
    expect(checks("apps/web/app/lib/medications/medications.sync.ts", tested)).toBe(
      `UNMAPPED ${UNMAPPED_DEFAULT}`,
    );
    expect(checks("apps/web/app/lib/sync/x.ts", tested)).toBe(`UNMAPPED ${UNMAPPED_DEFAULT}`);
  });

  it("lets a rule beat the unit-tested fallback", () => {
    const withRule = [...rules, ...parseRules("apps/web/app/lib/csp.ts  sign-in\n")];
    expect(checks("apps/web/app/lib/csp.ts", () => true, withRule)).toBe("sign-in");
  });

  it("gives an unmapped file the default checks", () => {
    expect(checks("somewhere/else.ts")).toBe(`UNMAPPED ${UNMAPPED_DEFAULT}`);
  });
});

describe("parseRules", () => {
  it("skips comments and blank lines, and refuses a rule with no checks", () => {
    expect(parseRules("# c\n\n  a/*   x  y \n").map((r) => [r.glob, r.checks, r.line])).toEqual([
      ["a/*", "x y", 3],
    ]);
    expect(() => parseRules("a/*\n", "f")).toThrow(/f:1: a rule needs checks/);
  });
});

describe("lint", () => {
  const files = ["src/a.ts", "src/b/c.ts", "docs/x.md", "src/a.test.ts"];
  const lintOf = (...texts) =>
    lint(
      texts.flatMap((t, i) => parseRules(t, `f${i}`)),
      files,
      none,
    );

  it("passes when every file maps and every rule matches", () => {
    expect(lintOf("src/* -\n", "*.md -\n")).toEqual([]);
  });

  it("finds unmapped files, dead rules, duplicate globs and ties", () => {
    expect(lintOf("src/b/* -\n")).toEqual(["no rule for src/a.ts", "no rule for docs/x.md"]);
    expect(lintOf("src/* -\n*.md -\nold/* -\n")).toEqual(["dead rule f0:3 old/*: matches no tracked file"]);
    expect(lintOf("src/* -\n*.md -\n", "src/* ui\n")).toEqual([
      "duplicate glob src/*: f0:1 src/* and f1:1 src/*",
    ]);
    expect(lintOf("src/*.ts -\n*.md -\n", "src/?.ts ui\n")).toEqual([
      "tie for src/a.ts: f0:1 src/*.ts = f1:1 src/?.ts",
    ]);
  });

  it("counts a rule that only test files match as dead (they never reach the rules)", () => {
    expect(lintOf("src/* -\n*.md -\n*.test.ts -\n")).toEqual([
      "dead rule f0:3 *.test.ts: matches no tracked file",
    ]);
  });

  it("passes over the real check-areas.d/ and git ls-files", () => {
    const real = loadRules(new URL("./check-areas.d", import.meta.url).pathname);
    const tracked = execFileSync("git", ["-C", ROOT, "ls-files"], { encoding: "utf8" })
      .split("\n")
      .filter((f) => f && existsSync(join(ROOT, f)));
    expect(lint(real, tracked, (p) => existsSync(join(ROOT, p)))).toEqual([]);
  });
});

describe("the command line", () => {
  const dir = mkdtempSync(join(tmpdir(), "check-areas-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "areas"));
  writeFileSync(join(dir, "areas/a"), "src/* ui\nsrc/x/* -\n");
  writeFileSync(join(dir, "areas/b"), "src/x/*.ts phase2\nsrc/y/*.ts one\nsrc/y/?.ts two\n");
  const run = (args, input) =>
    spawnSync("node", [CLI, ...args, "--root", dir, "--areas", join(dir, "areas")], {
      encoding: "utf8",
      input,
    });

  it("prints file<TAB>checks for files given as arguments or on stdin", () => {
    const byArgs = run(["resolve", "src/a.ts", "src/x/b.ts", "other"]);
    expect(byArgs.status).toBe(0);
    expect(byArgs.stdout).toBe(`src/a.ts\tui\nsrc/x/b.ts\tphase2\nother\tUNMAPPED ${UNMAPPED_DEFAULT}\n`);
    const byStdin = run(["resolve"], "src/a.ts\n\nsrc/x/b.md\n");
    expect(byStdin.stdout).toBe("src/a.ts\tui\nsrc/x/b.md\t-\n");
  });

  it("exits 2 on a tie, naming both rules, and still answers", () => {
    const r = run(["resolve", "src/y/a.ts"]);
    expect(r.status).toBe(2);
    expect(r.stdout).toBe("src/y/a.ts\tone\n");
    expect(r.stderr).toMatch(/tie for src\/y\/a\.ts: b:2 src\/y\/\*\.ts = b:3 src\/y\/\?\.ts/);
  });
});
