import type { SyncDb } from "~/lib/sync";
import type { Fixture } from "./fixtures";

import { DrizzleAppSchema, wrapPowerSyncWithDrizzle } from "@powersync/drizzle-driver";
import { PowerSyncDatabase } from "@powersync/web";
import { drizzleSchema, powerSyncSchema } from "~/lib/sync/schema";
import { WAIT_TIMEOUT } from "./found";

// The test device's database: a real PowerSync database with the device
// schema, in this Chromium tab, that never connects (no connector, so
// nothing downloads and nothing uploads). Local writes still go through
// PowerSync's views and queue in `ps_crud`, as on a phone that's offline.

const AppSchema = new DrizzleAppSchema(powerSyncSchema);

/** A fresh, empty local-only database for `userId`. Close it with `db.powersync.close()`. */
export const openTestDatabase = async (userId: string): Promise<SyncDb> => {
  const powersync = new PowerSyncDatabase({
    schema: AppSchema,
    database: {
      // Its own file per test: nothing carries over between tests.
      dbFilename: `test-device-${crypto.randomUUID()}.sqlite`,
      // In the page itself: no shared worker to outlive the test, no tab locks.
      enableMultiTabs: false,
      useWebWorker: false,
    },
  });
  const watches = trackWatches(powersync);
  await powersync.init();
  watches.listen();
  const db = { userId, powersync, drizzle: wrapPowerSyncWithDrizzle(powersync, { schema: drizzleSchema }) };
  trackers.set(db.powersync, watches);
  return db;
};

// ---- Live queries in flight (for `settle`) -----------------------------------

/** One watched query (`useLiveQuery`, a live note's watches): is a result still owed? */
type Watch = {
  sql: string;
  params: unknown[] | undefined;
  /** The tables it reads (PowerSync's `resolveTables`); null until resolved. */
  tables: Set<string> | null;
  /** Bumped on every change to one of its tables. */
  changes: number;
  /** `changes` when its latest run started, or -1 before the first. */
  ranAt: number;
  /** `changes` its latest result answers, or -1 before the first. */
  answered: number;
};

type Tracker = {
  /** The watches still owed a result: not run since their tables last changed. */
  pending: () => Watch[];
  /** When a watch last changed state (a change, a run, a result), as `performance.now()`. */
  lastActivity: () => number;
  listen: () => void;
};

const trackers = new WeakMap<PowerSyncDatabase, Tracker>();

const TABLE_PREFIX = /^ps_data(_local)?__/;

/**
 * Wraps one database's watches so `settle` can tell when every live query
 * has caught up: a watch is owed a result from the time one of its tables
 * changes until a run that started after that change reports. PowerSync runs
 * each watch's query through `executeReadOnly(sql, params)` with the watch's
 * own params array, which is how a run is matched to its watch.
 */
const trackWatches = (powersync: PowerSyncDatabase): Tracker => {
  const watches = new Set<Watch>();
  let activity = performance.now();
  const touch = () => (activity = performance.now());

  const watchWithCallback = powersync.watchWithCallback.bind(powersync);
  powersync.watchWithCallback = (sql, params, handler, options) => {
    if (!handler?.onResult || options?.signal?.aborted)
      return watchWithCallback(sql, params, handler, options);
    const watch: Watch = { sql, params, tables: null, changes: 0, ranAt: -1, answered: -1 };
    watches.add(watch);
    touch();
    options?.signal?.addEventListener("abort", () => watches.delete(watch));
    void powersync
      .resolveTables(sql, params, options)
      .then((tables) => (watch.tables = new Set(tables)))
      .catch(() => (watch.tables = new Set()));
    const settled = () => {
      watch.answered = watch.ranAt;
      touch();
    };
    return watchWithCallback(
      sql,
      params,
      {
        onResult: (result) => (settled(), handler.onResult(result)),
        onError: (error) => (settled(), handler.onError?.(error)),
      },
      options,
    );
  };

  // A private method of PowerSync's (shared-internals 1.6): if a later
  // version stops calling it, no watch is ever answered and every `settle`
  // times out naming its queries, rather than passing early.
  const internals = powersync as unknown as { executeReadOnly: (sql: string, params?: unknown[]) => unknown };
  const executeReadOnly = internals.executeReadOnly.bind(powersync);
  internals.executeReadOnly = (sql, params) => {
    for (const watch of watches)
      if (watch.params === params && watch.sql === sql) {
        watch.ranAt = watch.changes;
        touch();
      }
    return executeReadOnly(sql, params);
  };

  return {
    pending: () => [...watches].filter((w) => w.tables === null || w.answered < w.changes || w.answered < 0),
    lastActivity: () => activity,
    listen: () => {
      powersync.database.registerListener({
        tablesUpdated: (update) => {
          const changed = update.tables.map((t) => t.replace(TABLE_PREFIX, ""));
          for (const watch of watches)
            if (!watch.tables || changed.some((t) => watch.tables!.has(t))) {
              watch.changes += 1;
              touch();
            }
        },
      });
    },
  };
};

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Wait until the screen has caught up with the database: every live query
 * whose tables changed has rerun and reported, and the DOM then stays
 * unchanged for a whole frame. Use it after a stored write, `sync()` or
 * `unsync()`, before reading the screen. Throws after `timeout` ms, saying
 * what was still moving.
 */
export const settle = async (db: SyncDb, { timeout = WAIT_TIMEOUT }: { timeout?: number } = {}) => {
  const tracker = trackers.get(db.powersync);
  if (!tracker) throw new Error("settle: this database isn't a test device's (openTestDatabase).");
  const start = performance.now();
  // Behind any write still in flight, so its change notification is in.
  await db.powersync.getAll("SELECT 1");

  let mutated: boolean;
  const observer = new MutationObserver(() => (mutated = true));
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  try {
    // Quiet frames in a row: no pending query, no DOM change, no watch activity.
    let quiet = 0;
    for (;;) {
      const before = tracker.lastActivity();
      mutated = false;
      await nextFrame();
      const still = tracker.pending();
      quiet = still.length === 0 && !mutated && tracker.lastActivity() === before ? quiet + 1 : 0;
      // Two: one frame for React to commit what the last result set, one unchanged.
      if (quiet >= 2) return;
      if (performance.now() - start > timeout) {
        const why = still.length
          ? `${still.length} live ${still.length === 1 ? "query" : "queries"} still owed a result (${still
              .map((w) => w.sql.replace(/\s+/g, " ").slice(0, 80))
              .join("; ")})`
          : "the screen kept changing (the DOM changed in every frame)";
        throw new Error(`settle: the screen didn't settle within ${timeout} ms: ${why}.`);
      }
    }
  } finally {
    observer.disconnect();
  }
};

/**
 * Rows as if they had synced down: written straight into PowerSync's
 * storage tables (`ps_data__<table>`), the way a download lands, so they
 * queue no upload and fire the same change notifications. One transaction.
 */
export const syncDown = async (db: SyncDb, fixtures: readonly Fixture[]) => {
  if (fixtures.length === 0) return;
  await db.powersync.writeTransaction(async (tx) => {
    for (const { table, row } of fixtures) {
      await tx.execute(`INSERT OR REPLACE INTO ps_data__${table} (id, data) VALUES (?, ?)`, [
        row.id,
        JSON.stringify(row),
      ]);
    }
  });
};

/** Rows removed as a download would remove them (the row left the user's buckets). */
export const syncRemove = async (db: SyncDb, fixtures: readonly Pick<Fixture, "table" | "id">[]) => {
  await db.powersync.writeTransaction(async (tx) => {
    for (const { table, id } of fixtures)
      await tx.execute(`DELETE FROM ps_data__${table} WHERE id = ?`, [id]);
  });
};

/** The writes this device has queued for upload, oldest first (what PowerSync would send). */
export const queuedWrites = async (db: SyncDb) => {
  const rows = await db.powersync.getAll<{ data: string }>("SELECT data FROM ps_crud ORDER BY id");
  return rows.map(
    (r) =>
      JSON.parse(r.data) as {
        op: "PUT" | "PATCH" | "DELETE";
        type: string;
        id: string;
        data?: Record<string, unknown>;
      },
  );
};

// ---- Added by check-migration slice 10 (profiles) ----------------------------

/** PowerSync's status snapshot, as far as `setConnected` touches it (shared-internals 1.6). */
type StatusSnapshot = { core: Record<string, unknown> | null; jsState: unknown; constructor: unknown };

/**
 * Stand in for PowerSync's connection: the device never connects, so
 * `currentStatus.connected` is false unless a test says otherwise. Sets a
 * new status snapshot (connected or not) and tells PowerSync's status
 * listeners, as a real connect or disconnect does, so `useSyncState()` (the
 * profile's online-only Edit, the header's Offline) follows.
 */
export const setConnected = (db: SyncDb, connected: boolean) => {
  const powersync = db.powersync as unknown as {
    currentStatus: StatusSnapshot;
    iterateListeners: (cb: (listener: { statusChanged?: (status: unknown) => void }) => void) => void;
  };
  const now = powersync.currentStatus;
  const Snapshot = now.constructor as new (core: unknown, jsState: unknown) => StatusSnapshot;
  const status = new Snapshot(
    { connecting: false, downloading: null, streams: [], priority_status: [], ...now.core, connected },
    now.jsState,
  );
  powersync.currentStatus = status;
  powersync.iterateListeners((listener) => listener.statusChanged?.(status));
};

// ---- Added by sync-safety slice 3 --------------------------------------------

/**
 * Stand in for a failed upload (PowerSync's `uploadError`, which the header
 * shows as "Can't sync, retrying"): a new status snapshot with the error set,
 * or cleared, told to the status listeners as `setConnected` does.
 */
export const setUploadFailed = (db: SyncDb, failed: boolean) => {
  const powersync = db.powersync as unknown as {
    currentStatus: StatusSnapshot;
    iterateListeners: (cb: (listener: { statusChanged?: (status: unknown) => void }) => void) => void;
  };
  const now = powersync.currentStatus;
  const Snapshot = now.constructor as new (core: unknown, jsState: unknown) => StatusSnapshot;
  const jsState = {
    ...(now.jsState as Record<string, unknown>),
    uploadError: failed ? new Error("Sync: the server couldn't save a change; retrying") : undefined,
  };
  const status = new Snapshot(now.core, jsState);
  powersync.currentStatus = status;
  powersync.iterateListeners((listener) => listener.statusChanged?.(status));
};
