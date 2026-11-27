import type { SyncStatus } from "@powersync/web";
import type { SyncDb } from "./client";
import type * as SearchModuleNs from "../search/search.sync";

import { useEffect, useState, useSyncExternalStore } from "react";
import { clearRemembered } from "./remembered";

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
          providers: await import("../providers/providers.sync"),
          liveEntry: await import("../live-notes/liveEntry.sync"),
          timeline: await import("../timeline/timeline.sync"),
          medications: await import("../medications/medications.sync"),
          appointments: await import("../appointments/appointments.sync"),
          search: await import("../search/search.sync"),
          carePeriods: await import("../care-periods/carePeriods.sync"),
          medicationPasses: await import("../medications/medicationPasses.sync"),
          dueDoses: await import("../medications/dueDoses.sync"),
          series: await import("../appointments/series.sync"),
          // The sync matrix's app writers (scripts/browser-checks/sync-writers.mjs).
          todos: await import("../todos/todos.sync"),
          allergies: await import("../medications/allergies.sync"),
          conditions: await import("../profiles/conditions.sync"),
          medicationConditions: await import("../profiles/medicationConditions.sync"),
          notes: await import("../live-notes/notes.sync"),
          entryTodos: await import("../todos/entryTodos.sync"),
          tags: await import("../tags/tags.sync"),
        });
      }
      // The search index follows the database (built in the background).
      searchIndex = import("../search/search.sync").then((m) => {
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
 * Start fetching the database's code (PowerSync and its worker) before
 * `openSync` needs it: a sign-in calls this as it redirects, so the download
 * runs beside the session check instead of after it (B-764). It opens nothing.
 */
export const preloadSync = (): void => {
  void import("./client").catch(() => undefined);
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
  // A new device remembers nothing (as after a sign-out).
  clearRemembered();
  closeWatches();
  current = db ? Promise.resolve(db) : null;
  ready = db;
  testFirstSyncDone = db ? (options.firstSyncDone ?? true) : null;
  if (db && options.search) {
    searchIndex = import("../search/search.sync").then((m) => {
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

/** Whose database is open (null: none), for device state kept per user, such as the tile cache. */
export const syncUserId = (): string | null => ready?.userId ?? null;

/**
 * Sign-out: stop syncing and wipe the device's copy, and forget the tiles'
 * remembered answers (`remembered.ts`). Safe to call when nothing is open.
 * With `keep` (a session the server ended with changes waiting, B-290) the
 * database is closed but not cleared, kept for its owner's next sign-in.
 */
export const closeSync = async ({ keep = false }: { keep?: boolean } = {}) => {
  const db = ready ?? (current ? await current.catch(() => null) : null);
  current = null;
  ready = null;
  closeWatches();
  owedFirst.clear();
  // The tile cache goes with the local copy.
  clearRemembered();
  const search = searchIndex;
  searchIndex = null;
  await search?.then((m) => m.stopSearchIndex()).catch(() => undefined);
  const m = await import("./client");
  if (keep) await m.closeKept(db);
  else await m.clear(db);
};

/** How many changes wait to upload: on the open database, else on the device's file (opened to count). */
export const countWaiting = async (): Promise<number> => {
  const db = ready ?? (current ? await current.catch(() => null) : null);
  const m = await import("./client");
  return m.countWaiting(db);
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

// Watch results wait for the next frame and are handed over together, so React
// renders them once (B-633). Each watch's result arrives in a task of its own,
// and a screen's state update renders it at once: a screen mounting with a
// dozen watches (the timeline back from an entry's page, three pages of rows)
// rendered once per watch, and each later query waited behind the render
// before it (fourteen ~70 ms renders in a row on a laptop, past 5 s on a
// loaded CI runner). The timer is for a hidden page, which runs no frames.
//
// While a watch's first result is still owed (a screen mounting), the frame
// waits for it too, up to `FIRST_RESULTS_HOLD_MS` (B-870): the queries run one
// at a time, and a render landing between them holds up every query after it:
// Back to the timeline answered over three frames and rendered it three times
// first (0.75-0.95 s on a laptop, past 5 s at a 4x CPU throttle, as on a loaded
// CI runner; held, 0.5 s and 1.9 s). Loader data is on screen meanwhile.
let waiting: (() => void)[] | null = null;
let waitingSince = 0;
/** Watches whose first result hasn't come in yet (cleared at sign-out). */
const owedFirst = new Set<object>();
const FRAMELESS_FLUSH_MS = 100;
const FIRST_RESULTS_HOLD_MS = 500;
/** The latest frame-and-timer pair: the one that runs first wins, the other does nothing. */
let round = 0;
const scheduleFlush = () => {
  const mine = ++round;
  const run = () => {
    if (mine === round) flushResults();
  };
  requestAnimationFrame(run);
  setTimeout(run, FRAMELESS_FLUSH_MS);
};
const flushResults = () => {
  if (owedFirst.size > 0 && performance.now() - waitingSince < FIRST_RESULTS_HOLD_MS) return scheduleFlush();
  round += 1;
  const due = waiting;
  waiting = null;
  for (const hand of due ?? []) hand();
};
const nextFrameResult = (hand: () => void) => {
  if (waiting) return void waiting.push(hand);
  waiting = [hand];
  waitingSince = performance.now();
  scheduleFlush();
};

/**
 * One open watch, shared by every subscriber to the same query (B-910): a
 * screen often asks the same thing more than once (the timeline back from an
 * entry ran 38 watches, 11 of them repeats), and each repeat was a query of
 * its own on every change. Closed when its last subscriber leaves.
 */
type SharedWatch = {
  controller: AbortController;
  subscribers: Set<(rows: unknown[]) => void>;
  /** The latest result, handed at once to a subscriber that joins later. */
  rows: unknown[] | null;
};

/** The open watches, by `key` (closed and cleared at sign-out). */
const watches = new Map<string, SharedWatch>();

const closeWatches = () => {
  for (const shared of watches.values()) shared.controller.abort();
  watches.clear();
};

/**
 * Whether two answers hold the same rows: the same count, and each row the
 * same columns with the same values (SQLite's are plain values, so `Object.is`).
 */
export const sameRows = (a: readonly unknown[], b: readonly unknown[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] as Record<string, unknown>;
    const y = b[i] as Record<string, unknown>;
    if (x === y) continue;
    const columns = Object.keys(x);
    if (columns.length !== Object.keys(y).length) return false;
    for (const column of columns) if (!(column in y) || !Object.is(x[column], y[column])) return false;
  }
  return true;
};

const openWatch = (db: SyncDb, key: string): SharedWatch => {
  const shared: SharedWatch = { controller: new AbortController(), subscribers: new Set(), rows: null };
  const { signal } = shared.controller;
  const [watchSql, watchParams] = JSON.parse(key) as [string, unknown[]];
  const first = {};
  owedFirst.add(first);
  signal.addEventListener("abort", () => owedFirst.delete(first));
  db.powersync.watch(
    watchSql,
    watchParams,
    {
      onResult: (result) => {
        owedFirst.delete(first);
        const rows = result.rows?._array ?? [];
        // PowerSync reruns a watch on any change to its tables, so most answers
        // repeat the last one (a note preview's query on a keystroke off screen):
        // passing those on re-rendered the whole screen for nothing (B-956).
        if (shared.rows && sameRows(shared.rows, rows)) return;
        shared.rows = rows;
        // The subscribers this result is for: one joining before the frame got it at once.
        const handed = [...shared.subscribers];
        nextFrameResult(() => {
          for (const onRows of handed) if (!signal.aborted && shared.subscribers.has(onRows)) onRows(rows);
        });
      },
      onError: (error) => {
        owedFirst.delete(first);
        console.error("Local query failed", error);
      },
    },
    { signal, throttleMs: 30 },
  );
  return shared;
};

/**
 * Watch a query (`key` is `JSON.stringify([sql, params])`) and pass each
 * result to `onRows`, at the next frame with every other watch's result that
 * came in meanwhile (above); returns the cleanup, after which nothing more is
 * passed. Subscribers to the same `key` share one watch (`SharedWatch`); one
 * joining a watch that has answered gets its latest rows at once. An answer
 * with the same rows as the last (`sameRows`) is passed to no one. With no
 * database open it watches nothing: a component can still mount while
 * sign-out is closing the database (a watch result arriving mid-sign-out
 * renders a new child), and there's nothing left to show it then.
 */
export const watchLiveQuery = <T>(key: string, onRows: (rows: T[]) => void): (() => void) => {
  if (!ready) return () => undefined;
  let shared = watches.get(key);
  if (!shared) {
    shared = openWatch(ready, key);
    watches.set(key, shared);
  }
  const mine = shared;
  // Its own function, so the same callback subscribed twice counts twice.
  const subscriber = (rows: unknown[]) => onRows(rows as T[]);
  mine.subscribers.add(subscriber);
  if (mine.rows) onRows(mine.rows as T[]);
  return () => {
    if (!mine.subscribers.delete(subscriber) || mine.subscribers.size > 0) return;
    mine.controller.abort();
    if (watches.get(key) === mine) watches.delete(key);
  };
};

/**
 * Rows of a local query, kept up to date as the database changes (local
 * writes, or other members' changes arriving through sync). `initial` is
 * what the loader read, shown until the watch reports.
 */
export const useLiveQuery = <T>(sql: string, params: unknown[], initial: T[]): T[] => {
  const key = JSON.stringify([sql, params]);
  // New loader data (a navigation) replaces whatever the watch last said,
  // unless the watch already answered this same query: it stays live (its
  // effect doesn't rerun for the same key), so its rows are the current ones
  // and resetting to `initial` would leave them stale until the next change
  // (B-235: re-picking the filter that's on). When only the query changes
  // (a bigger limit), the old rows stay up until the new results arrive, so
  // the list doesn't jump.
  const [state, setState] = useState<{ initial: T[]; rows: T[]; key: string | null }>({
    initial,
    rows: initial,
    key: null,
  });
  let current = state;
  if (state.initial !== initial) {
    current = state.key === key ? { ...state, initial } : { initial, rows: initial, key: null };
    setState(current);
  }

  useEffect(() => watchLiveQuery<T>(key, (rows) => setState((s) => ({ ...s, rows, key }))), [key]);

  return current.rows;
};

/**
 * The header's sync state: PowerSync's connection and data flow, whether its
 * last upload failed (`uploadFailed`), how many writes wait to upload
 * (`waiting`, the upload queue) and how many lines "Changes not saved" lists
 * (`notSaved`: the local-only `unsaved_change`, one per row).
 */
export type SyncState = {
  connected: boolean;
  uploading: boolean;
  downloading: boolean;
  hasSynced: boolean;
  uploadFailed: boolean;
  waiting: number;
  notSaved: number;
};

type Counts = Pick<SyncState, "waiting" | "notSaved">;

const toState = (s: SyncStatus, counts: Counts): SyncState => ({
  connected: s.connected,
  uploading: !!s.dataFlowStatus.uploading,
  downloading: !!s.dataFlowStatus.downloading,
  hasSynced: !!s.hasSynced,
  uploadFailed: !!s.dataFlowStatus.uploadError,
  ...counts,
});

/** The queue's length and the not-saved lines, as one live query. */
const COUNTS_SQL = `SELECT (SELECT count(*) FROM ps_crud) AS waiting,
  (SELECT count(DISTINCT line_key) FROM unsaved_change) AS notSaved`;

/** PowerSync's connection state and the counts, for the header's indicator. */
export const useSyncState = (): SyncState | null => {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [counts, setCounts] = useState<Counts>({ waiting: 0, notSaved: 0 });
  useEffect(() => {
    let dispose: (() => void) | undefined;
    const controller = new AbortController();
    void current?.then((db) => {
      if (controller.signal.aborted) return;
      setStatus(db.powersync.currentStatus);
      dispose = db.powersync.registerListener({ statusChanged: setStatus });
      db.powersync.watch(
        COUNTS_SQL,
        [],
        {
          onResult: (result) => {
            const row = result.rows?._array[0] as Partial<Counts> | undefined;
            setCounts({ waiting: Number(row?.waiting ?? 0), notSaved: Number(row?.notSaved ?? 0) });
          },
          onError: (error) => console.error("Local query failed", error),
        },
        { signal: controller.signal, throttleMs: 30 },
      );
    });
    return () => {
      controller.abort();
      dispose?.();
    };
  }, []);
  return status ? toState(status, counts) : null;
};
