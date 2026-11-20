import type { SyncStatus } from "@powersync/web";
import type { SyncDb } from "./client";
import type * as SearchModuleNs from "./search";

import { useEffect, useState, useSyncExternalStore } from "react";

export type { SyncDb };

type SearchModule = typeof SearchModuleNs;

// The one entry point to the local database for routes and components.
// PowerSync itself loads lazily (./client), so importing this on the server
// (route modules are imported during SSR) costs nothing.
//
// The /app layout's clientLoader opens it once the session is known; screens
// below it can then use `getSync()` synchronously.

let current: Promise<SyncDb> | null = null;
let ready: SyncDb | null = null;
let searchIndex: Promise<SearchModule> | null = null;
/** Set by `installTestDatabase` only: whether a test device counts as synced. */
let testFirstSyncDone: boolean | null = null;

/** Open (or reuse) the local database for this user. */
export const openSync = async (userId: string): Promise<SyncDb> => {
  // Someone else signed in on this tab: their predecessor's data goes first.
  if (ready && ready.userId !== userId) await closeSync();
  current ??= import("./client")
    .then((m) => m.open(userId))
    .then((db) => {
      // Dev and check builds only (`pnpm prd serve --built` sets
      // VITE_CHECK_BUILD): lets browser checks and the console query the local
      // copy, and load the device modules without Vite's source imports. A
      // production build drops this block.
      if (import.meta.env.DEV || import.meta.env.VITE_CHECK_BUILD === "1") {
        const w = window as { caretookSync?: SyncDb; caretookModules?: () => Promise<unknown> };
        w.caretookSync = db;
        w.caretookModules = async () => ({
          providers: await import("./providers"),
          liveEntry: await import("./liveEntry"),
          timeline: await import("./timeline"),
          medications: await import("./medications"),
          appointments: await import("./appointments"),
          search: await import("./search"),
          carePeriods: await import("./carePeriods"),
          medicationPasses: await import("./medicationPasses"),
          dueDoses: await import("./dueDoses"),
        });
      }
      // The search index follows the database (built in the background).
      searchIndex = import("./search").then((m) => {
        void m.startSearchIndex(db);
        return m;
      });
      return (ready = db);
    })
    .catch((e: unknown) => {
      current = null;
      throw e;
    });
  return current;
};

/**
 * The test seam (component tests only: Vitest's mode is "test"): put a
 * database in place of `openSync`'s, so `getSync`, `useLiveQuery` and the
 * local writes use it. `apps/web/test/device.tsx` opens a local-only
 * database (no connector, no upload) and installs it here; `null` takes it
 * out again. `firstSyncDone` (default true) stands in for PowerSync's
 * `hasSynced`, which a database that never connects never sets. `search`
 * starts the search index on it, as `openSync` does.
 */
export const installTestDatabase = async (
  db: SyncDb | null,
  options: { firstSyncDone?: boolean; search?: boolean } = {},
) => {
  if (import.meta.env.MODE !== "test") throw new Error("installTestDatabase is for component tests only.");
  const search = searchIndex;
  searchIndex = null;
  await search?.then((m) => m.stopSearchIndex()).catch(() => undefined);
  current = db ? Promise.resolve(db) : null;
  ready = db;
  testFirstSyncDone = db ? (options.firstSyncDone ?? true) : null;
  if (db && options.search) {
    searchIndex = import("./search").then((m) => {
      void m.startSearchIndex(db);
      return m;
    });
    await searchIndex;
  }
};

/** The open database. Only valid below the /app layout, after its loader ran. */
export const getSync = (): SyncDb => {
  if (!ready) throw new Error("The local database isn't open yet (it opens in the /app layout's loader).");
  return ready;
};

/** Sign-out: stop syncing and wipe the device's copy. Safe to call when nothing is open. */
export const closeSync = async () => {
  const db = ready ?? (current ? await current.catch(() => null) : null);
  current = null;
  ready = null;
  const search = searchIndex;
  searchIndex = null;
  await search?.then((m) => m.stopSearchIndex()).catch(() => undefined);
  const m = await import("./client");
  await m.clear(db);
};

/**
 * How long a screen's loader waits for a new device's first sync before it
 * renders anyway (with a syncing state, see `FirstSyncPending`). Locally the
 * first sync lands about 150 ms after the database opens, so a synced device
 * and a normal sign-in never see the syncing state.
 */
export const FIRST_SYNC_WAIT_MS = 1_000;

/**
 * "First sync is done": this device has finished its first full download,
 * so a missing row really is missing. True at once on later visits (and
 * offline), since PowerSync keeps it with the local copy.
 */
export const isFirstSyncDone = (db: SyncDb): boolean =>
  testFirstSyncDone ?? !!db.powersync.currentStatus.hasSynced;

/**
 * Wait for the first full download on a new device, so screens don't flash
 * "nothing here yet". Gives up after `ms` (a slow first sync, or offline on
 * first launch), and returns at once on later visits. Resolves to
 * `isFirstSyncDone` afterwards.
 */
export const waitForFirstSync = async (db: SyncDb, ms = FIRST_SYNC_WAIT_MS): Promise<boolean> => {
  if (isFirstSyncDone(db)) return true;
  const signal = AbortSignal.timeout(ms);
  await db.powersync.waitForFirstSync({ signal }).catch(() => undefined);
  return isFirstSyncDone(db);
};

/** `isFirstSyncDone` for components: flips to true when the first sync finishes. Below the /app layout only. */
export const useFirstSyncDone = (): boolean =>
  useSyncExternalStore(subscribeToStatus, firstSyncDoneSnapshot, () => false);

const subscribeToStatus = (onChange: () => void) =>
  ready ? ready.powersync.registerListener({ statusChanged: onChange }) : () => undefined;
const firstSyncDoneSnapshot = () => !!ready && isFirstSyncDone(ready);

/**
 * Watch a query (`key` is `JSON.stringify([sql, params])`) and pass each
 * result to `onRows`; returns the cleanup. With no database open it watches
 * nothing: a component can still mount while sign-out is closing the
 * database (a watch result arriving mid-sign-out renders a new child), and
 * there's nothing left to show it then.
 */
export const watchLiveQuery = <T>(key: string, onRows: (rows: T[]) => void): (() => void) => {
  if (!ready) return () => undefined;
  const controller = new AbortController();
  const [watchSql, watchParams] = JSON.parse(key) as [string, unknown[]];
  ready.powersync.watch(
    watchSql,
    watchParams,
    {
      onResult: (result) => onRows((result.rows?._array ?? []) as T[]),
      onError: (error) => console.error("Local query failed", error),
    },
    { signal: controller.signal, throttleMs: 30 },
  );
  return () => controller.abort();
};

/**
 * Rows of a local query, kept up to date as the database changes (local
 * writes, or other members' changes arriving through sync). `initial` is
 * what the loader read, shown until the watch reports.
 */
export const useLiveQuery = <T>(sql: string, params: unknown[], initial: T[]): T[] => {
  const key = JSON.stringify([sql, params]);
  // New loader data (a navigation) replaces whatever the watch last said.
  // When only the query changes (a bigger limit), the old rows stay up
  // until the new results arrive, so the list doesn't jump.
  const [state, setState] = useState({ initial, rows: initial });
  if (state.initial !== initial) setState({ initial, rows: initial });

  useEffect(() => watchLiveQuery<T>(key, (rows) => setState((s) => ({ ...s, rows }))), [key]);

  return state.initial === initial ? state.rows : initial;
};

export type SyncState = { connected: boolean; uploading: boolean; downloading: boolean; hasSynced: boolean };

const toState = (s: SyncStatus): SyncState => ({
  connected: s.connected,
  uploading: !!s.dataFlowStatus.uploading,
  downloading: !!s.dataFlowStatus.downloading,
  hasSynced: !!s.hasSynced,
});

/** PowerSync's connection state, for the "Offline" / "Saving…" indicator. */
export const useSyncState = (): SyncState | null => {
  const [state, setState] = useState<SyncState | null>(null);
  useEffect(() => {
    let dispose: (() => void) | undefined;
    let cancelled = false;
    void current?.then((db) => {
      if (cancelled) return;
      setState(toState(db.powersync.currentStatus));
      dispose = db.powersync.registerListener({ statusChanged: (s) => setState(toState(s)) });
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);
  return state;
};
