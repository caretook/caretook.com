// The CI env: every variable the test projects read is set, and every value is
// generated and fictional. The scan reads the test files and test harnesses, so
// a test that starts reading a new variable fails here until the env sets it.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BUILD_UNSET,
  CI_PG_PORT,
  CI_STACK,
  CI_ZONE,
  FICTIONAL_PREFIX,
  SECRET_NAMES,
  ciBrowserEnv,
  ciBuildEnv,
  ciEnv,
} from "./env.mjs";

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

// What a build reads: its config, and the app's env reads outside tests. A
// default parameter (`env = process.env`) is a server's, read per variable below.
const BUILD_SOURCES = execFileSync(
  "git",
  [
    "ls-files",
    "apps/web/vite.config.ts",
    "apps/web/react-router.config.ts",
    "apps/web/build-target.ts",
    "apps/web/app/*",
  ],
  { cwd: root, encoding: "utf8" },
)
  .split("\n")
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.endsWith("env.d.ts"));

const readByBuilds = () =>
  [
    ...new Set(
      BUILD_SOURCES.flatMap((f) =>
        [
          ...readFileSync(`${root}${f}`, "utf8").matchAll(
            /(?:process\.env\.|import\.meta\.env\.)([A-Z][A-Z0-9_]*)/g,
          ),
        ].map((m) => m[1]),
      ),
    ),
  ]
    // Vite's own flags, set by every build.
    .filter((name) => !["DEV", "PROD", "MODE", "SSR", "BASE_URL"].includes(name))
    .sort();

describe("the CI build env", () => {
  it("sets every variable the builds read, or says why it stays unset", () => {
    expect(BUILD_SOURCES.length).toBeGreaterThan(100);
    const env = ciBuildEnv();
    const read = readByBuilds();
    expect(read).toContain("VITE_POWERSYNC_URL");
    expect(read).toContain("APP_URL");
    expect(read.filter((name) => !(name in env) && !(name in BUILD_UNSET))).toEqual([]);
  });

  it("builds for production and never as a check build", () => {
    const env = ciBuildEnv();
    expect(env.NODE_ENV).toBe("production");
    for (const name of Object.keys(BUILD_UNSET)) expect(env).not.toHaveProperty(name);
  });

  it("keeps its values fictional: secrets generated, URLs on this machine", () => {
    const env = ciBuildEnv(() => "abc123");
    for (const name of SECRET_NAMES) expect(env[name].startsWith(FICTIONAL_PREFIX)).toBe(true);
    for (const name of ["APP_URL", "POWERSYNC_URL", "VITE_POWERSYNC_URL"])
      expect(new URL(env[name]).hostname).toBe("localhost");
    expect(env.VITE_API_ORIGIN).toBe("");
  });
});

describe("the CI browser env", () => {
  it("makes a check build that mails to the dev mailbox, in the browsers' zone", () => {
    const env = ciBrowserEnv();
    expect(env).toMatchObject({ VITE_CHECK_BUILD: "1", MAIL_SENDER: "log", TZ: CI_ZONE });
    expect(CI_ZONE).toBe("America/Los_Angeles");
    expect(new URL(env.APP_URL).hostname).toBe("localhost");
  });

  it("leaves NODE_ENV unset, since the seed refuses production", () => {
    expect(ciBrowserEnv()).not.toHaveProperty("NODE_ENV");
  });

  it("binds where PowerSync's container can reach the JWKS", () => {
    const env = ciBrowserEnv();
    expect(env.HOST).toBe("0.0.0.0");
    const jwks = new URL(env.PS_JWKS_URL);
    expect(jwks.hostname).toBe("host.docker.internal");
    expect(jwks.port).toBe(env.PORT);
    expect(new URL(env.BASE).port).toBe(env.PORT);
    expect(env.POWERSYNC_URL).toBe(env.VITE_POWERSYNC_URL);
  });

  it("uses the Compose stack's database and container", () => {
    const env = ciBrowserEnv();
    const db = new URL(env.DATABASE_URL);
    expect([db.hostname, db.port]).toEqual(["localhost", env.PG_PORT]);
    expect(env.CARETOOK_STACK).toBe(CI_STACK);
    expect(env.PG_CONTAINER).toBe(`${CI_STACK}-postgres-1`);
  });

  it("generates its keys, each marked fictional", () => {
    const [a, b] = [ciBrowserEnv(), ciBrowserEnv()];
    for (const name of [...SECRET_NAMES, "INVITE_LINK_KEY"]) {
      expect(a[name].startsWith(FICTIONAL_PREFIX)).toBe(true);
      expect(a[name]).not.toBe(b[name]);
    }
  });
});

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

  it("uses the run's generated database password, and refuses one not marked fictional", () => {
    const password = `${FICTIONAL_PREFIX}fromplan`;
    expect(new URL(ciEnv(undefined, password).DATABASE_URL).password).toBe(password);
    expect(() => ciEnv(undefined, "hunter2")).toThrow(/marked fictional/);
  });

  it("prints as NAME=value lines with no newline in a value", () => {
    for (const [name, value] of Object.entries(ciEnv())) {
      expect(name).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(value).not.toMatch(/\n/);
    }
  });
});
