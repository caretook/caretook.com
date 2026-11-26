// Caretook's plain browser runner (browser-run.sh) with the real Playwright
// config, reporter and fixtures, on fake specs that never open a browser, in a
// throwaway tree with no .loops/ (as CI runs it): the lines a check prints, smoke
// mode, the results file, its timeout and a proof run's forced failure. Then the
// real check map (check-areas.d/) through the check-areas resolver, as
// `pnpm prd browser --changed` asks it. The gate around the runner (lease, caps,
// retry, watchdog) has its tests in the core's browser.test.mjs.
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { FORCED_LINE } from "../ci/browser-job.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const RUNNER = join(HERE, "browser-run.sh");

const SPECS = {
  specpass: [
    `import { expect, test } from "./fixtures.mjs";`,
    `test("core", { tag: "@smoke" }, async () => {`,
    `  await test.step("a step", () => expect(1).toBe(1));`,
    `});`,
    `test("extra", () => expect(2).toBe(2));`,
  ].join("\n"),
  specfail: [
    `import { expect, test } from "./fixtures.mjs";`,
    `test("fine", () => {});`,
    `test("broken", async () => {`,
    `  await test.step("a soft step", () => expect.soft(2, "soft").toBe(3));`,
    `  expect(1, "the number").toBe(2);`,
    `});`,
  ].join("\n"),
  specslow: [
    `import { test } from "./fixtures.mjs";`,
    `test("slow", async () => {`,
    `  for (let i = 0; i < 120; i++) { console.log("tick " + i); await new Promise((r) => setTimeout(r, 250)); }`,
    `});`,
  ].join("\n"),
};

let root, tree;

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "browser-run-test-")));
  tree = join(root, "tree");
  const checks = join(tree, "scripts/browser-checks");
  mkdirSync(checks, { recursive: true });
  mkdirSync(join(tree, "scripts/project"), { recursive: true });
  cpSync(RUNNER, join(tree, "scripts/project/browser-run.sh"));
  for (const [name, src] of Object.entries(SPECS))
    writeFileSync(join(checks, `${name}.spec.mjs`), `${src}\n`);
  for (const file of ["playwright.config.mjs", "reporter.mjs", "fixtures.mjs"])
    cpSync(join(HERE, "../browser-checks", file), join(checks, file));
  symlinkSync(join(HERE, "../../node_modules"), join(tree, "node_modules"));
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

const runner = (args, extra = {}) => {
  const r = spawnSync("bash", [join(tree, "scripts/project/browser-run.sh"), ...args], {
    cwd: tree,
    encoding: "utf8",
    env: { ...process.env, PATH: `${dirname(process.execPath)}:${process.env.PATH}`, SMOKE: "0", ...extra },
  });
  return { out: `${r.stdout}${r.stderr}`, status: r.status };
};

const SLOW = { timeout: 90_000 };

describe("the plain runner", SLOW, () => {
  it("lists the tree's checks with their specs", () => {
    const { out, status } = runner(["list"]);
    expect(status).toBe(0);
    expect(out).toBe(
      [
        "specfail\tscripts/browser-checks/specfail.spec.mjs",
        "specpass\tscripts/browser-checks/specpass.spec.mjs",
        "specslow\tscripts/browser-checks/specslow.spec.mjs",
        "",
      ].join("\n"),
    );
  });

  it("runs a check through Playwright Test with no .loops/, a PASS line per test and step, and the tally", () => {
    expect(existsSync(join(tree, ".loops"))).toBe(false);
    const results = join(root, "pass.tsv");
    const { out, status } = runner(["run", "--results", results, "specpass"]);
    expect(status, out).toBe(0);
    expect(out).toMatch(/^· {2}core › a step \(/m);
    expect(out).toMatch(/^PASS core \(/m);
    expect(out).toMatch(/^PASS extra \(/m);
    expect(out).toMatch(/^2\/2 passed$/m);
    expect(readFileSync(results, "utf8")).toBe("specpass\tpass\t0\n");
  });

  it("shows FAIL lines with their errors, and writes FAIL and MISSING results in order", () => {
    const results = join(root, "fail.tsv");
    const output = join(root, "out");
    const { out, status } = runner(["run", "--output", output, "--results", results, "specfail", "nosuch"]);
    expect(status).toBe(1);
    expect(out).toMatch(/^✗ broken › a soft step\n {2}Error: soft/m);
    expect(out).toMatch(/^FAIL broken\n {2}Error: soft[\s\S]* {2}Error: the number/m);
    expect(out).toMatch(/no check nosuch/);
    expect(readFileSync(results, "utf8")).toBe("specfail\tFAIL\t0\nnosuch\tMISSING\t0\n");
    // The failure's trace went to the folder it was given.
    expect(existsSync(join(output, "pw-specfail"))).toBe(true);
  });

  it("runs only @smoke tests in smoke mode, and says which it skipped", () => {
    const { out, status } = runner(["run", "scripts/browser-checks/specpass.spec.mjs"], { SMOKE: "1" });
    expect(status, out).toBe(0);
    expect(out).toMatch(/^PASS core /m);
    expect(out).toMatch(/^SKIP extra \(smoke\)$/m);
    expect(out).toMatch(/^1\/1 passed$/m);
  });

  it("ends a check at --timeout as TIMEOUT", () => {
    const results = join(root, "slow.tsv");
    const { status } = runner(["run", "--timeout", "3", "--results", results, "specslow.spec.mjs"]);
    expect(status).toBe(1);
    expect(readFileSync(results, "utf8")).toBe("specslow\tTIMEOUT\t0\n");
  });

  it("fails a proof run's forced spec on its first line, as a plain FAIL", () => {
    const spec = join(tree, "scripts/browser-checks/specforced.spec.mjs");
    writeFileSync(spec, `${FORCED_LINE}${SPECS.specpass}\n`);
    try {
      const results = join(root, "forced.tsv");
      const { out, status } = runner(["run", "--results", results, "specforced"]);
      expect(status, out).not.toBe(0);
      expect(out).toContain("forced failure for the CI proof run");
      expect(readFileSync(results, "utf8")).toBe("specforced\tFAIL\t0\n");
    } finally {
      rmSync(spec);
    }
  });
});

const PACKAGE = '{\n  "name": "a",\n  "scripts": { "x": "1" }\n}\n';

// The real manifest's checks and check-areas.d/ through the resolver, in a
// throwaway repo with a stub file per check (the selection only, nothing runs).
describe("the real check map", SLOW, () => {
  let real;
  // The map and the manifest where risa.json puts them.
  const paths = JSON.parse(readFileSync(join(HERE, "../../risa.json"), "utf8")).paths;
  const names = () =>
    readFileSync(join(HERE, "../..", paths.checksManifest), "utf8")
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("#"))
      .map((l) => l.split(/\s+/)[0]);
  const resolve = () => {
    const files = execFileSync("git", ["-C", real, "ls-files", "--others", "--modified", "--deleted"], {
      encoding: "utf8",
    });
    const r = spawnSync(
      process.execPath,
      [
        join(real, "scripts/project/check-areas.mjs"),
        "resolve",
        "--root",
        real,
        "--areas",
        join(real, paths.checkAreas),
        "--base",
        "HEAD",
      ],
      { cwd: real, encoding: "utf8", input: files },
    );
    expect(r.status, r.stderr).toBe(0);
    return Object.fromEntries(
      r.stdout
        .trim()
        .split("\n")
        .map((l) => l.split("\t")),
    );
  };
  const changed = (files) => {
    execFileSync("git", ["-C", real, "clean", "-qfd", "apps", "packages"]);
    for (const f of files) {
      mkdirSync(dirname(join(real, f)), { recursive: true });
      writeFileSync(join(real, f), "// changed\n");
    }
    return resolve();
  };

  beforeAll(() => {
    real = join(root, "real");
    const checks = join(real, "scripts/browser-checks");
    mkdirSync(checks, { recursive: true });
    cpSync(join(HERE, "../..", paths.checkAreas), join(real, paths.checkAreas), { recursive: true });
    cpSync(HERE, join(real, "scripts/project"), {
      recursive: true,
      filter: (src) => !src.endsWith(".test.mjs"),
    });
    for (const name of names()) writeFileSync(join(checks, `${name}.spec.mjs`), "\n");
    mkdirSync(join(real, "packages/data"), { recursive: true });
    writeFileSync(join(real, "packages/data/package.json"), PACKAGE);
    execFileSync("git", ["init", "-q", real]);
    execFileSync("git", ["-C", real, "add", "."]);
    execFileSync("git", [
      "-C",
      real,
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@example.com",
      "commit",
      "-qm",
      "base",
    ]);
  });

  it("leaves out the lean set for a scripts-only package.json and keeps it for any other change", () => {
    const file = "packages/data/package.json";
    execFileSync("git", ["-C", real, "clean", "-qfd", "apps", "packages"]);
    try {
      writeFileSync(join(real, file), PACKAGE.replace('"x": "1"', '"x": "2"'));
      expect(resolve()[file]).toBe("- (scripts only)");
      writeFileSync(join(real, file), PACKAGE.replace('"name": "a"', '"name": "b"'));
      expect(resolve()[file]).toBe("@suite");
    } finally {
      execFileSync("git", ["-C", real, "checkout", "-q", "--", file]);
    }
  });

  it("selects no end-to-end check for a timeline-only change (component tests cover it)", () => {
    const got = changed([
      "apps/web/app/routes/app/groups/timeline/TimelineEntryRow.tsx",
      "apps/web/app/routes/app/groups/timeline/TimelineEntryCard.tsx",
      "apps/web/app/routes/app/groups/timeline/TodayCard.tsx",
      "apps/web/app/routes/app/groups/timeline/timelineLayout.browser.test.tsx",
    ]);
    expect(
      Object.values(got).every((c) => c.startsWith("-")),
      JSON.stringify(got),
    ).toBe(true);
    expect(got["apps/web/app/routes/app/groups/timeline/TimelineEntryRow.tsx"]).toBe("-");
  });

  it("maps a lib module, a device query and a screen through the area rules and fallbacks", () => {
    const got = changed([
      "apps/web/app/lib/timeline/exampleRule.ts",
      "apps/web/app/lib/timeline/exampleRule.test.ts",
      "apps/web/app/lib/timeline/timeline.sync.ts",
      "apps/web/app/routes/app/groups/settings/members/MembersList.tsx",
    ]);
    expect(got).toEqual({
      "apps/web/app/lib/timeline/exampleRule.ts": "- (unit-tested)",
      "apps/web/app/lib/timeline/exampleRule.test.ts": "-",
      "apps/web/app/lib/timeline/timeline.sync.ts": "phase2 roundtrip",
      "apps/web/app/routes/app/groups/settings/members/MembersList.tsx": "app-shell",
    });
  });

  it("needs nothing for a check the change deletes (its screens moved to component tests)", () => {
    const gone = "scripts/browser-checks/phase2.spec.mjs";
    execFileSync("git", ["-C", real, "clean", "-qfd", "apps", "packages"]);
    rmSync(join(real, gone));
    try {
      expect(resolve()[gone]).toBe("- (deleted)");
    } finally {
      execFileSync("git", ["-C", real, "checkout", "--", gone]);
    }
  });

  it("runs the lean set for a migration", () => {
    const got = changed(["packages/data/src/db/migrations/0099_example.sql"]);
    expect(got["packages/data/src/db/migrations/0099_example.sql"]).toBe("@suite");
  });
});
