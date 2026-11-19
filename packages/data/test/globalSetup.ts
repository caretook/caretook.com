import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { clear } from "../src/db/clear";
import { endClient } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { maintenanceUrl } from "../src/db/testDatabase";
import { isError } from "../src/errors";
import { loadTestEnv } from "./env";

const TEST_DB_SCRIPT = fileURLToPath(new URL("../../../scripts/loops/test-db.sh", import.meta.url));

const connect = async (url: string) => {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  await client.connect();
  return client;
};

/**
 * A worktree's database on the shared test Postgres: start the server if it
 * isn't running (test-db.sh, which never recreates a running one), then create
 * the database if it's missing. Another worktree creating its own at the same
 * moment is fine; a race on the same name counts as created.
 */
const ensureSharedDatabase = async (url: URL, name: string) => {
  const admin = maintenanceUrl(url);
  let client: pg.Client;
  try {
    client = await connect(admin);
  } catch {
    execFileSync("bash", [TEST_DB_SCRIPT, "up"], {
      stdio: ["ignore", "inherit", "inherit"],
      env: { ...process.env, CARETOOK_SHARED_TEST_PORT: url.port },
    });
    client = await connect(admin);
  }
  try {
    const found = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (found.rowCount === 0) {
      // The name passed SHARED_TEST_DB_NAME (letters, digits, _), so quoting is enough.
      await client.query(`CREATE DATABASE "${name}"`).catch((e: { code?: string }) => {
        if (e.code !== "42P04") throw e; // duplicate_database: created by a parallel run
      });
    }
  } finally {
    await client.end();
  }
};

// Runs once per `vitest` run, before any integration file: start from an
// empty, fully migrated test database (in a worktree, only its own).
export default async function setup() {
  const db = loadTestEnv();
  if (db.shared) await ensureSharedDatabase(db.url, db.name);

  const hint = db.shared ? "pnpm prd test-db status" : "pnpm datastore:up:test";
  for (const step of [clear, migrate]) {
    const res = await step();
    if (isError(res)) {
      await endClient();
      throw new Error(`Test database setup failed (${String(res.code)}). Is it running? ${hint}`, {
        cause: res.cause ?? res,
      });
    }
  }
  await endClient();
}
