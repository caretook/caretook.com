import { fileURLToPath } from "node:url";
import { testDatabase, workerDatabase } from "../src/db/testDatabase";
import { loadEnv } from "../src/utils/loadEnv";

const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url));

/**
 * The pool's connect budget in tests (the app's is 2 s). pg-pool times a
 * connect on the test process's own clock, so under a loaded check a worker
 * whose event loop or libuv thread pool is busy (Better Auth's scrypt, pg's
 * SCRAM handshake behind it) missed 2 s though the server answered at once:
 * "Connection terminated due to connection timeout" (B-388,
 * src/db/client.int.test.ts). 10 s matches Vitest's hook timeout, so a server
 * that's really down still fails a file about as soon as its first hook would.
 */
export const TEST_CONNECT_TIMEOUT_MS = 10_000;

/**
 * Load packages/data/.env.test(.local) and refuse anything but a local test
 * database: port 5435, PG_TEST_PORT in a loop's worktree, and on the shared
 * test Postgres (SHARED_TEST_DB=1) only a caretook_test_<worktree> database.
 */
export const loadTestEnv = () => {
  process.env.NODE_ENV = "test";
  loadEnv(PACKAGE_DIR);
  process.env.DATABASE_CONNECT_TIMEOUT_MS ||= String(TEST_CONNECT_TIMEOUT_MS);

  const db = testDatabase(process.env);
  if (!db.ok) throw new Error(db.reason);
  return db;
};

/**
 * In a test worker: load the test env, then point DATABASE_URL at this worker's
 * own database (`workerDatabaseName`, made by the global setup), before
 * anything connects. Real env vars win over the env files, so later loads keep it.
 */
export const loadWorkerEnv = () => {
  loadTestEnv();
  const db = workerDatabase(process.env);
  if (!db.ok) throw new Error(db.reason);
  process.env.DATABASE_URL = db.url.toString();
  return db;
};
