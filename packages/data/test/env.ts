import { fileURLToPath } from "node:url";
import { testDatabase } from "../src/db/testDatabase";
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
