// The brake list and the quarantine, and the real Vitest setup that skips what
// the quarantine names: by default, and the other way round under
// CARETOOK_QUARANTINE=run.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import {
  globToRegExp,
  isBrake,
  isQuarantined,
  parseBrakeList,
  parseQuarantine,
  readLists,
  skipsTest,
} from "./lists.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

describe("the brake list", () => {
  it("reads globs, skipping comments and blanks", () => {
    expect(parseBrakeList("# a\n\n a/*.ts \nb/**\n")).toEqual(["a/*.ts", "b/**"]);
  });

  it("keeps * inside a directory and lets ** cross them", () => {
    expect(globToRegExp("a/*.ts").test("a/b.ts")).toBe(true);
    expect(globToRegExp("a/*.ts").test("a/b/c.ts")).toBe(false);
    expect(globToRegExp("a/**/*.ts").test("a/c.ts")).toBe(true);
    expect(globToRegExp("a/**/*.ts").test("a/b/c.ts")).toBe(true);
    expect(globToRegExp("a/**").test("a/b/c.ts")).toBe(true);
    expect(isBrake("a.bts", ["a.ts"])).toBe(false);
  });

  it("has no line that matches no test file", async () => {
    const { brakes } = await readLists(root);
    const tests = execFileSync("git", ["ls-files", "*.test.ts", "*.test.tsx", "*.test.mjs"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 10_000_000,
    }).split("\n");
    expect(brakes.filter((glob) => !tests.some((f) => isBrake(f, [glob])))).toEqual([]);
  });

  it.each([
    "apps/web/app/lib/sync/uploader.browser.test.tsx",
    "apps/web/app/lib/todos/todos.sync.browser.test.tsx",
    "apps/web/app/lib/timeline/timeline.sync.test.ts",
    "packages/api/src/syncTodos.int.test.ts",
    "packages/data/src/permissions/permissions.test.ts",
    "packages/data/src/db/roles/roles.int.test.ts",
    "packages/api/src/connectors/readTools.int.test.ts",
    "packages/data/src/db/easyMigration.int.test.ts",
    "packages/data/src/db/seeds/guard.int.test.ts",
  ])("covers %s", async (file) => {
    expect(isBrake(file, (await readLists(root)).brakes)).toBe(true);
  });
});

describe("the quarantine", () => {
  const entry = { file: "a/b.test.ts", name: "suite breaks", item: "B-1" };

  it("holds no test on the brake list", async () => {
    const { brakes, quarantine } = await readLists(root);
    expect(quarantine.filter((e) => isBrake(e.file, brakes))).toEqual([]);
  });

  it("reads tab-separated lines and refuses a broken one", () => {
    expect(parseQuarantine("# header\n\na/b.test.ts\tsuite breaks\tB-1\n")).toEqual([entry]);
    expect(() => parseQuarantine("a/b.test.ts\tno item")).toThrow(/needs/);
    expect(() => parseQuarantine("a/b.test.ts\tname\tnot-an-item")).toThrow(/needs/);
  });

  it("matches a test by file and full name, from a relative or absolute path", () => {
    expect(isQuarantined([entry], "a/b.test.ts", "suite breaks")).toBe(true);
    expect(isQuarantined([entry], "/repo/a/b.test.ts", "suite breaks")).toBe(true);
    expect(isQuarantined([entry], "/repo/xa/b.test.ts", "suite breaks")).toBe(false);
    expect(isQuarantined([entry], "a/b.test.ts", "suite other")).toBe(false);
  });

  it("skips a listed test by default, and all but listed ones when asked to run them", () => {
    expect(skipsTest([entry], entry.file, entry.name, "")).toBe(true);
    expect(skipsTest([entry], entry.file, "another", "")).toBe(false);
    expect(skipsTest([entry], entry.file, entry.name, "run")).toBe(false);
    expect(skipsTest([entry], entry.file, "another", "run")).toBe(true);
  });
});

describe("the Vitest setup", () => {
  const dir = mkdtempSync(join(tmpdir(), "caretook-quarantine-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(
    join(dir, "fixture.test.mjs"),
    `describe("suite", () => {
  it("listed", () => { throw new Error("a quarantined test ran"); });
  it("other", () => {});
});
`,
  );
  writeFileSync(
    join(dir, "vitest.config.mjs"),
    `export default { test: {
  root: ${JSON.stringify(dir)},
  globals: true,
  include: ["fixture.test.mjs"],
  setupFiles: [${JSON.stringify(join(root, "scripts/ci/quarantine-setup.mjs"))}],
  provide: { caretookQuarantine: { entries: [{ file: "fixture.test.mjs", name: "suite listed", item: "B-1" }], mode: process.env.CARETOOK_QUARANTINE ?? "" } },
} };
`,
  );

  const run = (/** @type {string} */ mode) => {
    const out = join(dir, `out-${mode || "default"}.json`);
    const r = spawnSync(
      "pnpm",
      [
        "exec",
        "vitest",
        "run",
        "--config",
        join(dir, "vitest.config.mjs"),
        "--reporter=json",
        `--outputFile=${out}`,
      ],
      { cwd: root, encoding: "utf8", env: { ...process.env, CARETOOK_QUARANTINE: mode } },
    );
    const report = JSON.parse(readFileSync(out, "utf8"));
    const statuses = Object.fromEntries(
      report.testResults[0].assertionResults.map((/** @type {any} */ a) => [a.fullName, a.status]),
    );
    return { code: r.status, statuses };
  };

  it("skips a listed test by default", () => {
    const { code, statuses } = run("");
    expect(code).toBe(0);
    expect(statuses["suite other"]).toBe("passed");
    expect(statuses["suite listed"]).not.toBe("failed");
  }, 60_000);

  it("runs only the listed test under CARETOOK_QUARANTINE=run", () => {
    const { code, statuses } = run("run");
    expect(code).not.toBe(0);
    expect(statuses["suite listed"]).toBe("failed");
    expect(statuses["suite other"]).not.toBe("passed");
  }, 60_000);

  it("is in every project of the real config, so a local check skips them too", () => {
    const text = readFileSync(join(root, "vitest.config.ts"), "utf8");
    expect(text).toContain("].map(withQuarantine)");
    const listed = execFileSync(
      "pnpm",
      ["exec", "vitest", "list", "--filesOnly", "--project", "scripts:unit"],
      {
        cwd: root,
        encoding: "utf8",
      },
    );
    expect(listed).toContain("ci/lists.test.mjs");
  }, 60_000);
});
