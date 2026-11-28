import type { AbstractPowerSyncDatabase, PowerSyncBackendConnector } from "@powersync/web";

import { DrizzleAppSchema, wrapPowerSyncWithDrizzle } from "@powersync/drizzle-driver";
import { PowerSyncDatabase } from "@powersync/web";
import { authClient } from "../auth/auth-client";
import { forgetUserData } from "../auth/forgetUserData";
import { writeKept } from "../auth/keptCopy";
import { localCopyFate } from "../auth/localCopyRules";
import { rpc } from "../core/rpc";
import { releaseSyncLocksWhenCached } from "./pageCache";
import { dropSearchTables } from "../search/searchTables.sync";
import { drizzleSchema, powerSyncSchema } from "./schema";
import { uploadQueued } from "./uploader";

// The PowerSync database and its connection. Browser only: load it through
// `openSync()` in ./index.ts, never import it statically (it starts workers).

const AppSchema = new DrizzleAppSchema(powerSyncSchema);

// A page frozen in the back/forward cache must let go of the database, or the
// next page's never opens (see ./pageCache). Before PowerSync takes any lock.
if (navigator.locks) releaseSyncLocksWhenCached(navigator.locks, window);

const powersyncUrl = () => import.meta.env.VITE_POWERSYNC_URL as string | undefined;

/**
 * How PowerSync reaches our backend:
 * - fetchCredentials: a 15-minute Better Auth JWT (EdDSA, `aud` = POWERSYNC_URL).
 * - uploadData: the device's queued writes, through `sync.upload`, which runs
 *   them through the services (./uploader: refused ops are recorded as not
 *   saved, then acknowledged; the next sync restores the server's copy).
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

  uploadData: (database) => uploadQueued(database, (input) => rpc.sync.upload(input)),
};

const DB_FILENAME = "caretook.sqlite";

type DatabaseOptions = { dbFilename: string; enableMultiTabs?: boolean; useWebWorker?: boolean };

/** Component tests only (`setTestDatabaseFile`): a file of their own, in the page, never connected. */
let testDatabase: DatabaseOptions | null = null;

const createDatabase = () =>
  new PowerSyncDatabase({
    schema: AppSchema,
    // One file per device. Only one user's data is ever in it: see `open`.
    database: testDatabase ?? { dbFilename: DB_FILENAME },
  });

/**
 * The test seam (component tests only): `open`, `closeKept` and `clear` use
 * this database file instead of the device's, and `open` never connects.
 * `null` puts the device's back.
 */
export const setTestDatabaseFile = (options: DatabaseOptions | null) => {
  if (import.meta.env.MODE !== "test") throw new Error("setTestDatabaseFile is for component tests only.");
  testDatabase = options;
};

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
 * someone else's data (or we can't tell whose), it's wiped first, with the
 * previous user's localStorage keys (`forgetUserData`): a shared device never
 * shows one person another's care data. That includes a copy kept for its
 * owner after their session ended (`closeKept`); the owner's own sign-in
 * reopens it, and its waiting changes upload.
 */
export const open = async (userId: string): Promise<SyncDb> => {
  const powersync = createDatabase();
  await powersync.init();
  if (readOwner() !== userId && localCopyFate({ reason: "otherUser", waiting: 0 }) === "wipe") {
    // The previous user's settings, recent searches and lines go too (B-317).
    forgetUserData();
    // The search index holds the same text, outside PowerSync's tables.
    await dropSearchTables(powersync);
    await powersync.disconnectAndClear();
    writeOwner(userId);
  }
  // Open for its owner again: no longer a kept copy.
  writeKept(null);
  if (testDatabase) return syncDb(userId, powersync);
  if (powersyncUrl()) void powersync.connect(connector);
  else console.warn("VITE_POWERSYNC_URL is not set: the timeline won't sync.");
  return syncDb(userId, powersync);
};

const syncDb = (userId: string, powersync: AbstractPowerSyncDatabase): SyncDb => ({
  userId,
  powersync,
  drizzle: wrapPowerSyncWithDrizzle(powersync, { schema: drizzleSchema }),
});

/** How many changes wait to upload (PowerSync's queue), on `db` or, with none open, the device's file. */
export const countWaiting = async (db: SyncDb | null): Promise<number> => {
  const powersync = db?.powersync ?? createDatabase();
  try {
    const row = await powersync.get<{ n: number }>("SELECT count(*) AS n FROM ps_crud");
    return Number(row.n);
  } finally {
    if (!db) await powersync.close();
  }
};

/**
 * A session the server ended with changes still waiting: stop syncing and
 * close the database without clearing it, keeping its owner, and mark it
 * kept (`writeKept`) so it expires if nobody comes back for it.
 */
export const closeKept = async (db: SyncDb | null) => {
  await closeHandle(db);
  writeKept(Date.now());
};

/**
 * Stop syncing and close this tab's handle, touching nothing stored: the
 * file, its owner and any kept mark stay (a stale tab handing over, B-296).
 */
export const closeHandle = async (db: SyncDb | null) => {
  if (!db) return;
  await db.powersync.disconnect();
  await db.powersync.close();
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
  writeKept(null);
  await deleteOpfsFile();
};
