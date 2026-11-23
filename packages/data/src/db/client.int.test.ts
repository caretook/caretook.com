import { sql } from "drizzle-orm";
import { execFileSync } from "node:child_process";
import { closeSync, constants, mkdtempSync, openSync, rmSync } from "node:fs";
import { open } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { endClient, getDb } from "./client";

// B-388: under a loaded full check, the connector files failed with
// "Connection terminated due to connection timeout": pg-pool's connect budget
// (`connectionTimeoutMillis`) runs on the test process's clock, and a starved
// worker misses it though the server answers in milliseconds. Two ways a
// worker starves, both seen in those files: its event loop held past the
// budget (the timer fires before the socket's reply is read), and libuv's
// thread pool queued up (Better Auth's scrypt per sign-in; pg's SCRAM
// handshake and the `localhost` lookup wait behind it). The test env gives the
// pool a longer budget (packages/data/test/env.ts); these stall a fresh
// connect past the app's 2 s and well inside the tests' 10 s, without
// burning CPU, so they don't load the check they guard.

const STALL_MS = 3000;

/** A pool with no connections yet, so the next query has to connect. */
const freshPool = async () => {
  await endClient();
  return getDb();
};

afterEach(async () => {
  await endClient();
});

/** Hold the event loop for `ms`, as a starved worker's synchronous work does (asleep, not spinning). */
const holdEventLoop = (ms: number) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

/**
 * Hold every libuv thread for `ms`: each opens a FIFO for reading, which
 * blocks its thread until a writer opens it. Resolves once they're released.
 */
const holdThreadPool = async (ms: number) => {
  const threads = Number(process.env.UV_THREADPOOL_SIZE) || 4;
  const dir = mkdtempSync(join(tmpdir(), "caretook-pool-"));
  const fifo = join(dir, "hold");
  execFileSync("mkfifo", [fifo]);
  const readers = Array.from({ length: threads }, () => open(fifo, "r"));
  try {
    await new Promise((resolve) => setTimeout(resolve, ms));
  } finally {
    // A non-blocking writer releases every blocked reader at once.
    closeSync(openSync(fifo, constants.O_WRONLY | constants.O_NONBLOCK));
    for (const reader of await Promise.all(readers)) await reader.close();
    rmSync(dir, { recursive: true, force: true });
  }
};

/** Let a started query reach the pool: its connect timer set, its socket opening. */
const nextTurn = () => new Promise((resolve) => setImmediate(resolve));

describe("the integration tests' pool", { timeout: 30_000 }, () => {
  it("connects though the event loop is held past the app's 2 s connect budget", async () => {
    const db = await freshPool();
    // Drizzle's queries start on `then`.
    const query = db.execute(sql`SELECT 1 AS one`).then((r) => r.rows);
    await nextTurn();
    holdEventLoop(STALL_MS);
    expect(await query).toEqual([{ one: 1 }]);
  });

  it("connects though libuv's thread pool is held past the app's 2 s connect budget", async () => {
    const db = await freshPool();
    const held = holdThreadPool(STALL_MS);
    const started = Date.now();
    const result = await db.execute(sql`SELECT 1 AS one`);
    const waited = Date.now() - started;
    await held;
    expect(result.rows).toEqual([{ one: 1 }]);
    // The connect really waited on the held threads.
    expect(waited).toBeGreaterThan(2000);
  });
});
