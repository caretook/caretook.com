import type { AbstractPowerSyncDatabase, PowerSyncBackendConnector } from "@powersync/web";

import { DrizzleAppSchema, wrapPowerSyncWithDrizzle } from "@powersync/drizzle-driver";
import { PowerSyncDatabase } from "@powersync/web";
import { authClient } from "../auth-client";
import { rpc } from "../rpc";
import { drizzleSchema } from "./schema";

// The PowerSync database and its connection. Browser only: load it through
// `openSync()` in ./index.ts, never import it statically (it starts workers).

const AppSchema = new DrizzleAppSchema(drizzleSchema);

/** Ops per upload request. Matches SYNC_BATCH_LIMIT in packages/api/src/sync.ts. */
const UPLOAD_BATCH = 100;

const powersyncUrl = () => import.meta.env.VITE_POWERSYNC_URL as string | undefined;

/**
 * How PowerSync reaches our backend:
 * - fetchCredentials: a 15-minute Better Auth JWT (EdDSA, `aud` = POWERSYNC_URL).
 * - uploadData: the device's queued writes, through `sync.upload`, which runs
 *   them through the services. Refused ops come back as `rejected` and are
 *   acknowledged; the next sync then restores the server's copy.
 */
const connector: PowerSyncBackendConnector = {
  async fetchCredentials() {
    const endpoint = powersyncUrl();
    if (!endpoint) return null;
    const { data, error } = await authClient.$fetch<{ token: string }>("/token", { method: "GET" });
    // No session: stay offline-only until the user signs in again.
    if (error?.status === 401) return null;
    // Anything else (offline, server down) is retried by PowerSync.
    if (error || !data) throw new Error(`Couldn't get a sync token (${error?.status ?? "no response"})`);
    return { endpoint, token: data.token };
  },

  async uploadData(database) {
    const batch = await database.getCrudBatch(UPLOAD_BATCH);
    if (!batch) return;
    const { results } = await rpc.sync.upload({
      ops: batch.crud.map((entry) => ({
        op: entry.op,
        table: entry.table,
        id: entry.id,
        data: entry.opData ?? null,
      })),
    });
    for (const result of results) {
      if (result.status === "rejected") console.warn("Sync: the server refused a change", result);
    }
    await batch.complete();
  },
};

const DB_FILENAME = "caretook.sqlite";

const createDatabase = () =>
  new PowerSyncDatabase({
    schema: AppSchema,
    // One file per device. Only one user's data is ever in it: see `open`.
    database: { dbFilename: DB_FILENAME },
  });

export type SyncDb = {
  userId: string;
  powersync: AbstractPowerSyncDatabase;
  drizzle: ReturnType<typeof wrapPowerSyncWithDrizzle<typeof drizzleSchema>>;
};

const OWNER_KEY = "caretook:sync-owner";

const readOwner = () => {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
};

const writeOwner = (userId: string | null) => {
  try {
    if (userId) localStorage.setItem(OWNER_KEY, userId);
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    // Without storage the owner is unknown, so the next open clears the data.
  }
};

/** The database this page opened last, for `pagehide`. */
let pageDatabase: AbstractPowerSyncDatabase | null = null;
let pageLifecycleBound = false;

/**
 * Keep a page in the back/forward cache from blocking the next one.
 *
 * A full load (a typed URL, a reload) puts the old page in the back/forward
 * cache, frozen. PowerSync's shared workers still count it as a connected tab
 * (its tab-close lock stays held), and if it was mid-query when it froze, its
 * database lease is never returned: the next page's `init()` waits for it,
 * for seconds or until the frozen page is evicted, and /app renders nothing.
 * So a page going into the cache closes its database (which hands the lease
 * back), and a page coming back out of it reloads to open it again.
 */
const releaseOnPageHide = (powersync: AbstractPowerSyncDatabase) => {
  pageDatabase = powersync;
  if (pageLifecycleBound) return;
  pageLifecycleBound = true;
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) void pageDatabase?.close();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) location.reload();
  });
};

/**
 * Open the local database for `userId` and start syncing. If the file holds
 * someone else's data (or we can't tell whose), it's wiped first: a shared
 * device never shows one person another's care data.
 */
export const open = async (userId: string): Promise<SyncDb> => {
  const powersync = createDatabase();
  releaseOnPageHide(powersync);
  await powersync.init();
  if (readOwner() !== userId) {
    await powersync.disconnectAndClear();
    writeOwner(userId);
  }
  if (powersyncUrl()) void powersync.connect(connector);
  else console.warn("VITE_POWERSYNC_URL is not set: the timeline won't sync.");
  return { userId, powersync, drizzle: wrapPowerSyncWithDrizzle(powersync, { schema: drizzleSchema }) };
};

/**
 * Delete the database's storage itself. Clearing tables isn't enough:
 * SQLite keeps freed pages, so deleted rows could still be read off the disk.
 * The file lives in IndexedDB, or in OPFS when PowerSync picks that VFS.
 */
const deleteFiles = async () => {
  const idb = new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_FILENAME);
    req.onsuccess = req.onerror = () => resolve();
    // PowerSync's shared worker (or another tab) still has it open. The rows
    // are already cleared; the file goes once the worker exits (next reload).
    req.onblocked = () => resolve();
  });
  const opfs = navigator.storage
    ?.getDirectory?.()
    .then((dir) => dir.removeEntry(DB_FILENAME, { recursive: true }))
    .catch(() => undefined);
  await Promise.all([idb, opfs]);
};

/** Stop syncing and delete everything stored locally (sign-out). */
export const clear = async (db: SyncDb | null) => {
  const powersync = db?.powersync ?? createDatabase();
  await powersync.disconnectAndClear();
  await powersync.close();
  writeOwner(null);
  await deleteFiles();
};
