import { fileURLToPath } from "node:url";
import { testDatabase, workerDatabase } from "../src/db/testDatabase";
import { loadEnv } from "../src/utils/loadEnv";

const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url));

/**
 * Load packages/data/.env.test(.local) and refuse anything but a local test
 * database: port 5435, PG_TEST_PORT in a loop's worktree, and on the shared
 * test Postgres (SHARED_TEST_DB=1) only a caretook_test_<worktree> database.
 */
export const loadTestEnv = () => {
  process.env.NODE_ENV = "test";
  loadEnv(PACKAGE_DIR);

  const db = testDatabase(process.env);
  if (!db.ok) throw new Error(db.reason);
  return db;
};

/**
 * In a test worker: load the test env, then point DATABASE_URL at this worker's
 * own database (`<name>_w<VITEST_POOL_ID>`, made by the global setup), before
 * anything connects. Real env vars win over the env files, so later loads keep it.
 */
export const loadWorkerEnv = () => {
  loadTestEnv();
  const db = workerDatabase(process.env);
  if (!db.ok) throw new Error(db.reason);
  process.env.DATABASE_URL = db.url.toString();
  return db;
};
