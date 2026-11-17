import { fileURLToPath } from "node:url";
import { loadEnv } from "../src/utils/loadEnv";

const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url));

/** Load packages/data/.env.test and refuse anything but the local test database. */
export const loadTestEnv = () => {
  process.env.NODE_ENV = "test";
  loadEnv(PACKAGE_DIR);

  const url = new URL(process.env.DATABASE_URL ?? "postgresql://missing");
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "5435") {
    throw new Error(`Integration tests only run against the local test database (got ${url.host})`);
  }
};
