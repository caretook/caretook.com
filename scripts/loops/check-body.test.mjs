// check-body.sh: a failing command fails the whole check and stops it (bash's set -e
// skips a command that is followed by `&&`, so each one is its own statement).
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const HERE = new URL(".", import.meta.url).pathname;
let root, bin, calls;

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "check-body-")));
  bin = join(root, "bin");
  calls = join(root, "calls");
  spawnSync("mkdir", [bin]);
  // A stub pnpm: log the arguments, fail when the first one is $STUB_FAIL.
  writeFileSync(
    join(bin, "pnpm"),
    '#!/bin/sh\necho "$*" >> "$STUB_CALLS"\n[ "$1" = "$STUB_FAIL" ] && exit 7\nexit 0\n',
  );
  chmodSync(join(bin, "pnpm"), 0o755);
  // The check-areas lint a slice or quick check runs with node: an empty script here.
  spawnSync("mkdir", ["-p", join(root, "scripts/loops")]);
  writeFileSync(join(root, "scripts/loops/check-areas.mjs"), "");
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

const body = (args, fail = "") => {
  writeFileSync(calls, "");
  const r = spawnSync("bash", [join(HERE, "check-body.sh"), ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, STUB_CALLS: calls, STUB_FAIL: fail },
  });
  return { status: r.status, ran: readFileSync(calls, "utf8").trimEnd().split("\n").filter(Boolean) };
};

describe("check-body.sh", () => {
  it("fails a full check at a failing pnpm check and runs nothing after it", () => {
    const r = body(["full", "base", "1"], "check");
    expect(r.status).not.toBe(0);
    expect(r.ran).toEqual(["check"]);
  });

  it("fails a quick check at a failing typecheck and runs nothing after it", () => {
    const r = body(["quick", "base", "1"], "typecheck");
    expect(r.status).not.toBe(0);
    expect(r.ran).toEqual(["typecheck"]);
  });

  it("fails a full check at a failing tooling test", () => {
    const r = body(["full", "base", "1"], "test:tooling");
    expect(r.status).not.toBe(0);
    expect(r.ran).toEqual(["check", "build:budget", "test:tooling"]);
  });

  it("passes a full check when every command passes", () => {
    const r = body(["full", "base", "1"]);
    expect(r.status).toBe(0);
    expect(r.ran).toEqual(["check", "build:budget", "test:tooling"]);
  });

  const UNIT =
    "exec vitest run --project data:unit --project web:unit --project notifications:unit --project server:unit --project scripts:unit";
  const runs = (r) => r.ran.filter((c) => !c.startsWith("exec vitest list"));

  it("a slice check runs every unit test and only the diff's own test files that still exist", () => {
    writeFileSync(join(root, "a.int.test.ts"), "");
    writeFileSync(join(root, "b.browser.test.tsx"), "");
    const r = body(["slice", "base", "0", "a.int.test.ts", "b.browser.test.tsx", "gone.int.test.ts"]);
    expect(r.status).toBe(0);
    expect(runs(r)).toEqual([
      "typecheck",
      "lint",
      "format:check",
      UNIT,
      "exec vitest run --project integration a.int.test.ts",
      "exec vitest run --project web:components b.browser.test.tsx",
      "docs:budget",
    ]);
  });

  it("a slice check with no test files of its own runs only the unit tests", () => {
    const r = body(["slice", "base", "0"]);
    expect(r.status).toBe(0);
    expect(runs(r)).toEqual(["typecheck", "lint", "format:check", UNIT, "docs:budget"]);
  });

  it("a quick check adds the integration tests related to the diff, and no other component test", () => {
    const r = body(["quick", "base", "1", "a.int.test.ts", "b.browser.test.tsx"]);
    expect(r.status).toBe(0);
    expect(runs(r)).toEqual([
      "typecheck",
      "lint",
      "format:check",
      UNIT,
      "exec vitest run --changed base --passWithNoTests --project integration",
      "exec vitest run --project web:components b.browser.test.tsx",
      "docs:budget",
      "test:tooling",
    ]);
  });
});
