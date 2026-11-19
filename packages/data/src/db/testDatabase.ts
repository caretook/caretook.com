/**
 * Which databases the integration tests may clear. Pure, so the rules have unit
 * tests; `packages/data/test/env.ts` applies them before anything connects.
 *
 * - The main checkout's (and an older loop worktree's) own test Postgres: a
 *   local host on `PG_TEST_PORT` (default 5435).
 * - A worktree's database on the shared test Postgres (`SHARED_TEST_DB=1`, from
 *   the `.env.test.local` that scripts/loops writes): a local host on
 *   `PG_TEST_PORT`, and a database named `caretook_test_<worktree>`, so a run
 *   never clears another server's or another worktree's main database.
 */

const LOCAL_HOSTS = ["localhost", "127.0.0.1"];

/** The databases a worktree may own on the shared test Postgres. */
export const SHARED_TEST_DB_NAME = /^caretook_test_[a-z0-9_]{1,49}$/;

export interface TestDatabaseEnv {
  DATABASE_URL?: string;
  PG_TEST_PORT?: string;
  SHARED_TEST_DB?: string;
}

export type TestDatabase =
  { ok: true; url: URL; shared: boolean; name: string } | { ok: false; reason: string };

/** Check the test env's database; `reason` says why it's refused. */
export const testDatabase = (env: TestDatabaseEnv): TestDatabase => {
  let url: URL;
  try {
    url = new URL(env.DATABASE_URL ?? "");
  } catch {
    return { ok: false, reason: "DATABASE_URL is missing or not a URL" };
  }
  const port = env.PG_TEST_PORT ?? "5435";
  if (!LOCAL_HOSTS.includes(url.hostname) || url.port !== port) {
    return {
      ok: false,
      reason: `Integration tests only run against the local test database (got ${url.host})`,
    };
  }
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const shared = env.SHARED_TEST_DB === "1";
  if (shared && !SHARED_TEST_DB_NAME.test(name)) {
    return {
      ok: false,
      reason: `On the shared test Postgres, tests only use a caretook_test_<worktree> database (got "${name}")`,
    };
  }
  return { ok: true, url, shared, name };
};

/** The same server's maintenance database, for CREATE DATABASE. */
export const maintenanceUrl = (url: URL) => {
  const admin = new URL(url);
  admin.pathname = "/postgres";
  return admin.toString();
};
