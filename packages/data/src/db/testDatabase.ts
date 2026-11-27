/**
 * Which databases the integration tests may clear. Pure, so the rules have unit
 * tests; `packages/data/test/env.ts` applies them before anything connects.
 *
 * - The main checkout's (and an older loop worktree's) own test Postgres: a
 *   local host on `PG_TEST_PORT` (default 5435).
 * - A worktree's database on the shared test Postgres (`SHARED_TEST_DB=1`, from
 *   the `.env.test.local` that the tool (Risa) writes): a local host on
 *   `PG_TEST_PORT`, and a database named `caretook_test_<worktree>`, so a run
 *   never clears another server's or another worktree's main database.
 * - Each integration worker's copy of it (`workerDatabase`):
 *   `caretook_tw_<stem>_<hash>_w<n>` on the same server (`workerDatabaseName`),
 *   made by the global setup; with one worker, the database itself.
 */

import { createHash } from "node:crypto";

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

/** How many integration workers when CARETOOK_INT_WORKERS isn't set. */
export const DEFAULT_INT_WORKERS = 3;
const MAX_INT_WORKERS = 16;

/** CARETOOK_INT_WORKERS as a count, 1 to 16 (default 3); undefined when it's anything else. */
export const intWorkers = (value: string | undefined): number | undefined => {
  if (value === undefined || value.trim() === "") return DEFAULT_INT_WORKERS;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= MAX_INT_WORKERS ? n : undefined;
};

// Worker copies live in their own namespace, `caretook_tw_<stem>_<hash>_w<n>`:
// the base's stem (without `caretook_test_`) cut to 38, then 8 hex of the full
// base's md5, so it stays within Postgres's 63 (it would silently truncate a
// longer one). No worktree base starts `caretook_tw_`, so `foo`'s worker can't
// be `foo-w1`'s base, and two long bases with the same first 38 differ by the
// hash. test-db.sh (`list`, `drop`) builds the same prefix in SQL, and
// Risa's loops/tidy.mjs in JS: change all three together.
const WORKER_PREFIX = "caretook_tw_";
const WORKER_STEM_LENGTH = 38;
const WORKER_HASH_LENGTH = 8;

/** Worker `n`'s database: `caretook_tw_<stem cut to 38>_<md5(base) cut to 8>_w<n>`. */
export const workerDatabaseName = (base: string, worker: number) => {
  const stem = base.replace(/^caretook_test_/, "").slice(0, WORKER_STEM_LENGTH);
  const hash = createHash("md5").update(base).digest("hex").slice(0, WORKER_HASH_LENGTH);
  return `${WORKER_PREFIX}${stem}_${hash}_w${worker}`;
};

/** The databases a run's workers use: the base alone for one worker, else one copy each. */
export const workerDatabaseNames = (base: string, workers: number) =>
  workers === 1 ? [base] : Array.from({ length: workers }, (_, i) => workerDatabaseName(base, i + 1));

/** Whether `name` is `base` or one of its worker databases (the only ones a run may drop). */
export const isOwnDatabase = (base: string, name: string) =>
  name === base || workerDatabaseNames(base, MAX_INT_WORKERS).includes(name);

export interface WorkerDatabaseEnv extends TestDatabaseEnv {
  CARETOOK_INT_WORKERS?: string;
  /** Vitest's worker slot, 1 to the project's maxWorkers. */
  VITEST_POOL_ID?: string;
}

/**
 * The database this integration worker uses: the checked test database's
 * copy for `VITEST_POOL_ID`, or the database itself with one worker. Refused
 * like `testDatabase`, and when the worker id is outside 1 to the worker count.
 */
export const workerDatabase = (env: WorkerDatabaseEnv): TestDatabase => {
  const base = testDatabase(env);
  if (!base.ok) return base;
  const workers = intWorkers(env.CARETOOK_INT_WORKERS);
  if (workers === undefined) {
    return {
      ok: false,
      reason: `CARETOOK_INT_WORKERS must be 1 to ${MAX_INT_WORKERS} (got "${env.CARETOOK_INT_WORKERS}")`,
    };
  }
  if (workers === 1) return base;
  const id = Number(env.VITEST_POOL_ID);
  if (!Number.isInteger(id) || id < 1 || id > workers) {
    return {
      ok: false,
      reason: `VITEST_POOL_ID must be a worker from 1 to ${workers} (got "${env.VITEST_POOL_ID}")`,
    };
  }
  // The checked base's server; only the name changes, to one of the base's own.
  const name = workerDatabaseName(base.name, id);
  const url = new URL(base.url);
  url.pathname = `/${name}`;
  return { ok: true, url, shared: base.shared, name };
};

/** The same server's maintenance database, for CREATE DATABASE. */
export const maintenanceUrl = (url: URL) => {
  const admin = new URL(url);
  admin.pathname = "/postgres";
  return admin.toString();
};
