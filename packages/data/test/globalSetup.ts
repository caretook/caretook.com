import type { TestDatabase } from "../src/db/testDatabase";

import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { clear } from "../src/db/clear";
import { endClient } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { intWorkers, isOwnDatabase, maintenanceUrl, workerDatabaseNames } from "../src/db/testDatabase";
import { isError } from "../src/errors";
import { loadTestEnv } from "./env";

const TEST_DB_SCRIPT = fileURLToPath(new URL("../../../scripts/project/test-db.sh", import.meta.url));

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

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

type Database = Extract<TestDatabase, { ok: true }>;

/** Clear and migrate the database DATABASE_URL names now. */
const clearAndMigrate = async (hint: string) => {
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
};

/**
 * Each worker's database, fresh: dropped, then copied from the migrated
 * database as a template. Postgres refuses a template while anyone else is
 * connected to it (55006, object_in_use: a closing pool's connections, or a
 * psql session), so a copy retries briefly, then falls back to an empty
 * database migrated on its own.
 */
const makeWorkerDatabases = async (db: Database, workers: number, hint: string) => {
  const client = await connect(maintenanceUrl(db.url));
  const migrateAlone: string[] = [];
  try {
    for (const name of workerDatabaseNames(db.name, workers)) {
      if (!isOwnDatabase(db.name, name))
        throw new Error(`Refusing "${name}": not one of ${db.name}'s databases`);
      await client.query(`DROP DATABASE IF EXISTS ${quote(name)} WITH (FORCE)`);
      for (let attempt = 1; ; attempt++) {
        try {
          await client.query(`CREATE DATABASE ${quote(name)} TEMPLATE ${quote(db.name)}`);
          break;
        } catch (e) {
          if ((e as { code?: string }).code !== "55006") throw e;
          if (attempt < 5) {
            await sleep(200 * attempt);
            continue;
          }
          await client.query(`CREATE DATABASE ${quote(name)}`);
          migrateAlone.push(name);
          break;
        }
      }
    }
  } finally {
    await client.end();
  }
  const baseUrl = process.env.DATABASE_URL;
  try {
    for (const name of migrateAlone) {
      const url = new URL(db.url);
      url.pathname = `/${name}`;
      process.env.DATABASE_URL = url.toString();
      await clearAndMigrate(hint);
    }
  } finally {
    process.env.DATABASE_URL = baseUrl;
  }
};

// Runs once per `vitest` run, before any integration file: start from an
// empty, fully migrated test database (in a worktree, only its own), and with
// more than one worker (CARETOOK_INT_WORKERS, default 3) a copy of it for
// each, `caretook_tw_<stem>_<hash>_w<n>` (workerDatabaseName), which that
// worker's files use (setup.ts).
export default async function setup() {
  const db = loadTestEnv();
  const workers = intWorkers(process.env.CARETOOK_INT_WORKERS);
  if (workers === undefined) throw new Error("CARETOOK_INT_WORKERS must be a number from 1 to 16");
  if (db.shared) await ensureSharedDatabase(db.url, db.name);

  const hint = db.shared ? "pnpm prd test-db status" : "pnpm datastore:up:test";
  await clearAndMigrate(hint);
  if (workers > 1) await makeWorkerDatabases(db, workers, hint);
}
