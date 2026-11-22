// The CI env: every variable the test projects read is set, and every value is
// generated and fictional. The scan reads the test files and test harnesses, so
// a test that starts reading a new variable fails here until the env sets it.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CI_PG_PORT, FICTIONAL_PREFIX, SECRET_NAMES, ciEnv } from "./env.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

const TEST_SOURCES = execFileSync(
  "git",
  [
    "ls-files",
    "packages/*/test/*",
    "apps/web/test/*",
    "packages/*.test.ts",
    "apps/web/app/*.test.ts",
    "apps/web/*.test.tsx",
    "vitest.config.ts",
  ],
  { cwd: root, encoding: "utf8" },
)
  .split("\n")
  .filter((f) => /\.tsx?$/.test(f));

const readByTests = () =>
  [
    ...new Set(
      TEST_SOURCES.flatMap((f) =>
        [...readFileSync(`${root}${f}`, "utf8").matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map(
          (m) => m[1],
        ),
      ),
    ),
  ].sort();

describe("the CI env", () => {
  it("sets every variable the test projects read", () => {
    expect(TEST_SOURCES.length).toBeGreaterThan(10);
    const env = ciEnv();
    expect(readByTests().filter((name) => !(name in env))).toEqual([]);
  });

  it("generates its secrets, each marked fictional", () => {
    const a = ciEnv();
    const b = ciEnv();
    for (const name of SECRET_NAMES) {
      expect(a[name].startsWith(FICTIONAL_PREFIX)).toBe(true);
      expect(a[name]).not.toBe(b[name]);
    }
    expect(a.BETTER_AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it("points only at this machine, with a generated, fictional database password", () => {
    const env = ciEnv(() => "abc123");
    const db = new URL(env.DATABASE_URL);
    expect([db.hostname, db.port]).toEqual(["localhost", CI_PG_PORT]);
    expect(db.password).toBe(`${FICTIONAL_PREFIX}abc123`);
    expect(env.PG_TEST_PORT).toBe(CI_PG_PORT);
    for (const name of ["APP_URL", "BETTER_AUTH_URL"]) expect(new URL(env[name]).hostname).toBe("localhost");
  });

  it("prints as NAME=value lines with no newline in a value", () => {
    for (const [name, value] of Object.entries(ciEnv())) {
      expect(name).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(value).not.toMatch(/\n/);
    }
  });
});
