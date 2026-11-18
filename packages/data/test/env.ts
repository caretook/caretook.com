import { fileURLToPath } from "node:url";
import { loadEnv } from "../src/utils/loadEnv";

const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url));

/**
 * Load packages/data/.env.test(.local) and refuse anything but the local test
 * database: port 5435, or PG_TEST_PORT in a loop's worktree.
 */
export const loadTestEnv = () => {
  process.env.NODE_ENV = "test";
  loadEnv(PACKAGE_DIR);

  const url = new URL(process.env.DATABASE_URL ?? "postgresql://missing");
  const port = process.env.PG_TEST_PORT ?? "5435";
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== port) {
    throw new Error(`Integration tests only run against the local test database (got ${url.host})`);
  }
};
