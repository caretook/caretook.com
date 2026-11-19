import type { AbstractPowerSyncDatabase, PowerSyncBackendConnector } from "@powersync/web";

import { DrizzleAppSchema, wrapPowerSyncWithDrizzle } from "@powersync/drizzle-driver";
import { PowerSyncDatabase } from "@powersync/web";
import { authClient } from "../auth-client";
import { rpc } from "../rpc";
import { releaseSyncLocksWhenCached } from "./pageCache";
import { dropSearchTables } from "./searchTables";
import { drizzleSchema } from "./schema";

// The PowerSync database and its connection. Browser only: load it through
// `openSync()` in ./index.ts, never import it statically (it starts workers).

const AppSchema = new DrizzleAppSchema(drizzleSchema);

// A page frozen in the back/forward cache must let go of the database, or the
// next page's never opens (see ./pageCache). Before PowerSync takes any lock.
if (navigator.locks) releaseSyncLocksWhenCached(navigator.locks, window);

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

/**
 * Open the local database for `userId` and start syncing. If the file holds
 * someone else's data (or we can't tell whose), it's wiped first: a shared
 * device never shows one person another's care data.
 */
export const open = async (userId: string): Promise<SyncDb> => {
  const powersync = createDatabase();
  await powersync.init();
  if (readOwner() !== userId) {
    // The search index holds the same text, outside PowerSync's tables.
    await dropSearchTables(powersync);
    await powersync.disconnectAndClear();
    writeOwner(userId);
  }
  if (powersyncUrl()) void powersync.connect(connector);
  else console.warn("VITE_POWERSYNC_URL is not set: the timeline won't sync.");
  return { userId, powersync, drizzle: wrapPowerSyncWithDrizzle(powersync, { schema: drizzleSchema }) };
};

/**
 * Clearing tables isn't enough: SQLite keeps freed pages, so deleted rows
 * could still be read off the disk. VACUUM rewrites the file without them
 * (IndexedDB's blocks past the new end are deleted). The file itself stays:
 * deleting the IndexedDB database is blocked while PowerSync's shared worker
 * still holds it, and a blocked delete stays queued, so the next sign-in's
 * open waited behind it for good (app-shell 6g, quick-fixes slice 38).
 */
const purgeFreedPages = (powersync: AbstractPowerSyncDatabase) =>
  powersync.execute("VACUUM").catch((e: unknown) => console.warn("Couldn't vacuum the local database", e));

/** OPFS, when PowerSync picks that VFS: removing a file still in use fails, and never waits. */
const deleteOpfsFile = () =>
  navigator.storage
    ?.getDirectory?.()
    .then((dir) => dir.removeEntry(DB_FILENAME, { recursive: true }))
    .catch(() => undefined);

/** Stop syncing and delete everything stored locally (sign-out). */
export const clear = async (db: SyncDb | null) => {
  const powersync = db?.powersync ?? createDatabase();
  await dropSearchTables(powersync).catch((e: unknown) => console.warn("Couldn't drop the search index", e));
  await powersync.disconnectAndClear();
  await purgeFreedPages(powersync);
  await powersync.close();
  writeOwner(null);
  await deleteOpfsFile();
};
