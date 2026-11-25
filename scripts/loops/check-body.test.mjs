// check-body.sh: a failing step fails the check and stops it; a failed test file
// is rerun alone, and a pass there is a flake. A stub pnpm stands in for every tool.
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { failedFiles, stepOf } from "./check-failed.mjs";

const HERE = new URL(".", import.meta.url).pathname;
let root, bin, calls, state;

// The stub: log the arguments; fail when they contain $STUB_FAIL. A vitest run
// reads $STUB_TESTS, "<file>:<times it fails>" pairs: a listed file still failing
// goes in the JSON report and fails the run.
const STUB = `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const line = args.filter((a) => !a.startsWith("--reporter=") && !a.startsWith("--outputFile.json=")).join(" ");
fs.appendFileSync(process.env.STUB_CALLS, line + "\\n");
if (process.env.STUB_FAIL && line.includes(process.env.STUB_FAIL)) process.exit(7);
const out = args.find((a) => a.startsWith("--outputFile.json="))?.split("=")[1];
if (!out) process.exit(0);
if (process.env.STUB_UNHANDLED) console.log("Vitest caught 1 unhandled error during the test run");
const seen = process.env.STUB_CALLS + ".seen";
const counts = fs.existsSync(seen) ? JSON.parse(fs.readFileSync(seen, "utf8")) : {};
const rerun = args.includes("--no-file-parallelism");
const failed = [];
for (const pair of (process.env.STUB_TESTS || "").split(",").filter(Boolean)) {
  const [file, times] = pair.split(":");
  if (rerun && !args.includes(file)) continue;
  counts[file] = (counts[file] || 0) + 1;
  if (counts[file] <= Number(times)) failed.push(file);
}
fs.writeFileSync(seen, JSON.stringify(counts));
fs.writeFileSync(out, JSON.stringify({ testResults: failed.map((name) => ({ name: process.cwd() + "/" + name, status: "failed" })) }));
process.exit(failed.length || process.env.STUB_UNHANDLED ? 1 : 0);
`;

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "check-body-")));
  bin = join(root, "bin");
  calls = join(root, "calls");
  state = join(root, "state");
  mkdirSync(bin);
  writeFileSync(join(bin, "pnpm"), STUB);
  chmodSync(join(bin, "pnpm"), 0o755);
  // The check-areas lint a slice or quick check runs with node: an empty script here.
  mkdirSync(join(root, "scripts/project"), { recursive: true });
  writeFileSync(join(root, "scripts/project/check-areas.mjs"), "");
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

const body = (args, fail = "", extra = {}) => {
  writeFileSync(calls, "");
  rmSync(`${calls}.seen`, { force: true });
  rmSync(state, { recursive: true, force: true });
  mkdirSync(state);
  const r = spawnSync("bash", [join(HERE, "check-body.sh"), ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      STUB_CALLS: calls,
      STUB_FAIL: fail,
      STUB_TESTS: "",
      STUB_UNHANDLED: "",
      CARETOOK_CHECK_STATE: state,
      CARETOOK_CHECK_COUNTS: "",
      ...extra,
    },
  });
  const read = (name) =>
    existsSync(join(state, name)) ? readFileSync(join(state, name), "utf8").trim().split("\n") : [];
  return {
    status: r.status,
    out: r.stdout,
    ran: readFileSync(calls, "utf8").trimEnd().split("\n").filter(Boolean),
    step: read("step")[0],
    failed: read("failed"),
    flaky: read("flaky"),
  };
};

const TSC = "--filter ./apps/* --filter ./packages/* exec tsc";
const ESLINT = "exec eslint .";
const PRETTIER = "exec prettier --check .";
const UNIT =
  "exec vitest run --project data:unit --project web:unit --project notifications:unit --project server:unit --project core:unit --project project:unit";
const ALL = "exec vitest run --project !tooling:unit --project !tooling:browser --project !project:tooling";
const TOOLING =
  "exec vitest run --project tooling:unit --project core:unit --project project:unit --project project:tooling";
const runs = (r) => r.ran.filter((c) => !c.startsWith("exec vitest list"));
// The three static tools run side by side, so their order is free.
const afterStatic = (r) => {
  const ran = runs(r);
  expect(ran[0]).toBe("typegen");
  expect(ran.slice(1, 4).sort()).toEqual([TSC, ESLINT, PRETTIER].sort());
  return ran.slice(4);
};

describe("check-body.sh", () => {
  it("runs one typegen", () => {
    const r = body(["slice", "base", "0"]);
    expect(r.ran.filter((c) => c === "typegen")).toHaveLength(1);
  });

  it("fails at a failing static step, names it and runs no test", () => {
    for (const [tool, step] of [
      ["exec tsc", "typecheck"],
      ["exec eslint", "lint"],
      ["exec prettier", "format"],
    ]) {
      const r = body(["quick", "base", "1"], tool);
      expect(r.status).toBe(7);
      expect(r.step).toBe(step);
      expect(afterStatic(r)).toEqual([]);
    }
  });

  it("fails at a failing typegen and runs nothing after it", () => {
    const r = body(["full", "base", "1"], "typegen");
    expect(r.status).toBe(7);
    expect(r.step).toBe("typecheck");
    expect(r.ran).toEqual(["typegen"]);
  });

  it("passes a full check when every command passes", () => {
    const r = body(["full", "base", "1"]);
    expect(r.status).toBe(0);
    expect(afterStatic(r)).toEqual([ALL, "docs:budget", "build:budget", TOOLING]);
  });

  it("a full check runs what pnpm check runs", () => {
    const pkg = JSON.parse(readFileSync(join(HERE, "../../package.json"), "utf8"));
    expect(pkg.scripts.check).toBe(
      "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm docs:budget",
    );
    expect(pkg.scripts.test).toBe(
      "vitest run --project '!tooling:unit' --project '!tooling:browser' --project '!project:tooling'",
    );
  });

  it("fails a full check at a failing tooling test and names the step", () => {
    const r = body(["full", "base", "1"], "", { STUB_TESTS: "scripts/loops/x.test.mjs:9" });
    expect(r.status).not.toBe(0);
    expect(r.step).toBe("unit");
    const t = body(["full", "base", "1"], "--project tooling:unit");
    expect(t.status).toBe(7);
    expect(t.step).toBe("tooling");
  });

  it("a slice check runs every unit test and only the diff's own test files that still exist", () => {
    writeFileSync(join(root, "a.int.test.ts"), "");
    writeFileSync(join(root, "b.browser.test.tsx"), "");
    const r = body(["slice", "base", "0", "a.int.test.ts", "b.browser.test.tsx", "gone.int.test.ts"]);
    expect(r.status).toBe(0);
    expect(afterStatic(r)).toEqual([
      UNIT,
      "exec vitest run --project integration a.int.test.ts",
      "exec vitest run --project web:components b.browser.test.tsx",
      "docs:budget",
    ]);
  });

  it("a slice check with no test files of its own runs only the unit tests", () => {
    const r = body(["slice", "base", "0"]);
    expect(r.status).toBe(0);
    expect(afterStatic(r)).toEqual([UNIT, "docs:budget"]);
  });

  it("a quick check adds the integration tests related to the diff, and no other component test", () => {
    const r = body(["quick", "base", "1", "a.int.test.ts", "b.browser.test.tsx"]);
    expect(r.status).toBe(0);
    expect(afterStatic(r)).toEqual([
      UNIT,
      "exec vitest run --changed base --passWithNoTests --project integration",
      "exec vitest run --project web:components b.browser.test.tsx",
      "docs:budget",
      TOOLING,
    ]);
  });
});

describe("check-body.sh reruns a failed test file", () => {
  const rerun = (...files) =>
    `exec vitest run --no-file-parallelism --project data:unit --project web:unit --project notifications:unit --project server:unit --project core:unit --project project:unit ${files.join(" ")}`;

  it("a file that passes alone passes the check and is reported as a flake", () => {
    const r = body(["slice", "base", "0"], "", { STUB_TESTS: "a.test.ts:1,ok.test.ts:0" });
    expect(r.status).toBe(0);
    expect(r.flaky).toEqual(["a.test.ts"]);
    expect(r.failed).toEqual([]);
    expect(runs(r)).toContain(rerun("a.test.ts"));
    expect(runs(r).at(-1)).toBe("docs:budget");
  });

  it("a file that fails twice fails the check, and the rerun names only the failed files", () => {
    const r = body(["slice", "base", "0"], "", { STUB_TESTS: "a.test.ts:2,b.test.ts:1,ok.test.ts:0" });
    expect(r.status).toBe(1);
    expect(r.step).toBe("unit");
    expect(r.failed).toEqual(["a.test.ts"]);
    expect(r.flaky).toEqual(["b.test.ts"]);
    expect(runs(r)).toContain(rerun("a.test.ts", "b.test.ts"));
    expect(runs(r)).not.toContain("docs:budget");
  });

  it("doesn't rerun after an unhandled error", () => {
    const r = body(["slice", "base", "0"], "", { STUB_TESTS: "a.test.ts:1", STUB_UNHANDLED: "1" });
    expect(r.status).toBe(1);
    expect(r.failed).toEqual(["a.test.ts"]);
    expect(r.ran.some((c) => c.includes("--no-file-parallelism"))).toBe(false);
  });

  it("doesn't rerun past the limit of failed files", () => {
    const r = body(["slice", "base", "0"], "", {
      STUB_TESTS: "a.test.ts:1,b.test.ts:1",
      CARETOOK_CHECK_RERUN_MAX: "1",
    });
    expect(r.status).toBe(1);
    expect(r.failed).toEqual(["a.test.ts", "b.test.ts"]);
    expect(r.ran.some((c) => c.includes("--no-file-parallelism"))).toBe(false);
  });
});

describe("check-failed.mjs", () => {
  it("names the failed files relative to the directory, and nothing from a broken report", () => {
    const report = JSON.stringify({
      testResults: [
        { name: "/r/b.test.ts", status: "failed" },
        { name: "/r/a.test.ts", status: "failed" },
        { name: "/r/ok.test.ts", status: "passed" },
      ],
    });
    expect(failedFiles(report, "/r")).toEqual(["a.test.ts", "b.test.ts"]);
    expect(failedFiles("not json", "/r")).toEqual([]);
    expect(failedFiles("{}", "/r")).toEqual([]);
  });

  it("names a mixed run's step from its files", () => {
    expect(stepOf(["a.test.ts", "b.int.test.ts"])).toBe("unit");
    expect(stepOf(["b.int.test.ts", "c.browser.test.tsx"])).toBe("integration");
    expect(stepOf(["c.browser.test.tsx"])).toBe("components");
  });
});
