import type { ApiOutputs } from "../core/rpc";

import { ORPCError } from "@orpc/client";
import {
  DEFAULT_DAY_SUMMARY_MODE,
  DEFAULT_EASY_MODE_SETTING,
  DEFAULT_PROVIDERS_VIEW,
  DEFAULT_TIMELINE_VIEW,
  DEFAULT_UNITS,
  EASY_MODE_SETTINGS,
  mergeSetupDismissed,
} from "@caretook/data/schema";
import { useSyncExternalStore } from "react";
import { NETWORK_ANSWER_MS, withTimeout } from "../auth/sessionRules";
import { load } from "../core/api";
import { rpc } from "../core/rpc";
import { settingsPlan } from "./settingsPlan";

// The signed-in user's settings (units, timeline and providers layouts, easy mode, day summaries). They live on
// `user.preferences`, which isn't synced, so the last copy is cached on the
// device: screens still show the right units offline.
//
// A change made offline is also kept as *pending* (per user) until the server
// has it: `saveSettings` tries at once, and `loadSettings` sends what's left
// before reading the server's copy. Last write wins: a pending change from
// this device overwrites one made on another device in the meantime, which is
// fine for display preferences.
//
// Loaders don't wait for the server when there's a cache (B-156):
// `loadSettings` answers from it at once and refreshes in the background.
// Every change to what this device knows (a refresh, a save, a load) is
// published to the settings store, so screens that read `useMySettings`
// re-render when a refresh brings different values.

export type MySettings = Pick<
  ApiOutputs["me"]["get"],
  "units" | "timelineView" | "providersView" | "easyMode" | "daySummary" | "setupDismissed"
>;
/** A change to some settings. `units` may name only some measures; `setupDismissed` adds to the list. */
export type SettingsChange = Partial<Omit<MySettings, "units">> & { units?: Partial<MySettings["units"]> };

const DEFAULTS: MySettings = {
  units: DEFAULT_UNITS,
  timelineView: DEFAULT_TIMELINE_VIEW,
  providersView: DEFAULT_PROVIDERS_VIEW,
  easyMode: DEFAULT_EASY_MODE_SETTING,
  daySummary: DEFAULT_DAY_SUMMARY_MODE,
  setupDismissed: [],
};

const PREFIX = "caretook:settings:";
const PENDING_PREFIX = "caretook:settings-pending:";
const cacheKey = (userId: string) => `${PREFIX}${userId}`;
const pendingKey = (userId: string) => `${PENDING_PREFIX}${userId}`;

const readJson = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const writeJson = (key: string, value: unknown) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the defaults apply offline.
  }
};

const merge = <T extends SettingsChange>(base: T, change: SettingsChange): T => {
  const next = { ...base, ...change };
  if (base.units || change.units) next.units = { ...base.units, ...change.units };
  if (base.setupDismissed || change.setupDismissed)
    next.setupDismissed = mergeSetupDismissed(base.setupDismissed, change.setupDismissed);
  return next;
};

const readCache = (userId: string): MySettings | null => {
  const cached = readJson<SettingsChange>(cacheKey(userId));
  return cached ? merge(DEFAULTS, cached) : null;
};

/**
 * The pending change, upgraded: one queued before the easy rename names
 * `simpleMode`, which the server now refuses and `clearPending` never
 * removes, so it would be resent forever (B-472). It becomes `easyMode`
 * (`simple` → `easy`, as migration 0034 did; a value with no equivalent is
 * dropped, and an `easyMode` queued since wins), and the upgrade is stored.
 */
const readPending = (userId: string): SettingsChange | null => {
  const pending = readJson<SettingsChange & { simpleMode?: unknown }>(pendingKey(userId));
  if (!pending || !("simpleMode" in pending)) return pending;
  const { simpleMode, ...upgraded } = pending;
  const easyMode = simpleMode === "simple" ? "easy" : simpleMode;
  if (!("easyMode" in upgraded)) {
    const setting = EASY_MODE_SETTINGS.find((s) => s === easyMode);
    if (setting) upgraded.easyMode = setting;
  }
  const left = Object.keys(upgraded).length ? upgraded : null;
  writeJson(pendingKey(userId), left);
  return left;
};

/** Forget the pending fields that were sent, unless they've changed again since. */
const clearPending = (userId: string, sent: SettingsChange) => {
  const pending = readPending(userId);
  if (!pending) return;
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const left: SettingsChange = { ...pending };
  if ("timelineView" in sent && same(left.timelineView, sent.timelineView)) delete left.timelineView;
  if ("providersView" in sent && same(left.providersView, sent.providersView)) delete left.providersView;
  if ("easyMode" in sent && same(left.easyMode, sent.easyMode)) delete left.easyMode;
  if ("daySummary" in sent && same(left.daySummary, sent.daySummary)) delete left.daySummary;
  if (left.setupDismissed && sent.setupDismissed) {
    const sentIds = new Set(sent.setupDismissed);
    left.setupDismissed = left.setupDismissed.filter((id) => !sentIds.has(id));
    if (left.setupDismissed.length === 0) delete left.setupDismissed;
  }
  if (left.units && sent.units) {
    const units: Record<string, unknown> = { ...left.units };
    for (const [measure, unit] of Object.entries(sent.units))
      if (same(units[measure], unit)) delete units[measure];
    left.units = units;
    if (Object.keys(units).length === 0) delete left.units;
  }
  writeJson(pendingKey(userId), Object.keys(left).length ? left : null);
};

/** fetch fails with a TypeError when there's no connection. */
const isNetworkError = (e: unknown) => e instanceof TypeError;
/** A lost session: keep what's pending for after the next sign-in. */
const isSignedOut = (e: unknown) => e instanceof ORPCError && e.code === "UNAUTHORIZED";

/** What each user's settings were when last published, and who's listening. */
const published = new Map<string, { json: string; settings: MySettings }>();
const listeners = new Set<() => void>();

/** Publish what this device now knows of the user's settings, if it changed; returns it. */
const publish = (userId: string): MySettings => {
  const settings = cachedSettings(userId);
  const json = JSON.stringify(settings);
  const last = published.get(userId);
  if (last?.json === json) return last.settings;
  published.set(userId, { json, settings });
  for (const listener of listeners) listener();
  return settings;
};

/** Hear about every published change to anyone's settings. Returns the unsubscribe. */
export const subscribeSettings = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * The user's settings, live: `initial` (a loader's `loadSettings`) until
 * something is published, then the latest (a background refresh, a save on
 * this page).
 */
export const useMySettings = (userId: string, initial: MySettings): MySettings =>
  useSyncExternalStore(
    subscribeSettings,
    () => published.get(userId)?.settings ?? initial,
    () => initial,
  );

/** Remember settings on this device (after loading them, or after a change). */
export const cacheSettings = (userId: string, settings: SettingsChange) => {
  writeJson(cacheKey(userId), merge(readCache(userId) ?? DEFAULTS, settings));
  publish(userId);
};

/**
 * Change some settings: cached and marked pending at once, then sent.
 * Resolves `"saved"` when the server has them, or `"pending"` when offline
 * (the next online `loadSettings` sends them). Any other failure rejects
 * with the API's error (use `toActionResult` for a form); a refused change
 * is no longer pending, though the cache keeps it until the next load.
 */
export const saveSettings = async (userId: string, change: SettingsChange): Promise<"saved" | "pending"> => {
  writeJson(pendingKey(userId), merge(readPending(userId) ?? {}, change));
  cacheSettings(userId, change);
  try {
    await rpc.me.updatePreferences(change);
  } catch (e) {
    if (isNetworkError(e)) return "pending";
    if (!isSignedOut(e)) clearPending(userId, change);
    throw e;
  }
  clearPending(userId, change);
  return "saved";
};

/**
 * Bring the cache up to date: send `send` (the pending change), then read the
 * server's copy and cache it. Resolves `"offline"` on a lost connection. A
 * refused change is dropped; a lost session (a sign-in redirect) and other
 * API errors reject.
 */
const refresh = async (request: Request, userId: string, send: SettingsChange | null) => {
  const since = forgotten;
  if (send) {
    try {
      await load(request, rpc.me.updatePreferences(send));
      clearPending(userId, send);
    } catch (e) {
      if (isNetworkError(e)) return "offline";
      // The server refused the change (say, a value this version no longer
      // accepts): drop it and use the server's copy.
      if (!(e instanceof ORPCError) || isSignedOut(e)) throw e;
      clearPending(userId, send);
    }
  }
  try {
    const me = await load(request, rpc.me.get());
    // Signed out meanwhile: the device has forgotten this user's settings.
    if (since !== forgotten) return "offline";
    cacheSettings(userId, {
      units: me.units,
      timelineView: me.timelineView,
      easyMode: me.easyMode,
      daySummary: me.daySummary,
      setupDismissed: me.setupDismissed,
    });
    return "refreshed";
  } catch (e) {
    // Anything but a lost connection (a sign-in redirect, an API error) is real.
    if (!isNetworkError(e)) throw e;
    return "offline";
  }
};

/** How many times `forgetSettings` has run: a refresh that outlives one doesn't cache. */
let forgotten = 0;

/** Each user's refresh in flight: loaders on one navigation share it. */
const refreshing = new Map<string, ReturnType<typeof refresh>>();

const sharedRefresh = (request: Request, userId: string, send: SettingsChange | null) => {
  let inflight = refreshing.get(userId);
  if (!inflight) {
    inflight = refresh(request, userId, send).finally(() => refreshing.delete(userId));
    refreshing.set(userId, inflight);
  }
  return inflight;
};

/**
 * Settings for a clientLoader (`settingsPlan`): with a cache, the cached copy
 * with pending changes on top, at once, while a background refresh sends
 * what's pending, reads the server's copy and publishes it (a lost session
 * there is left to the session check). With no cache, it waits for that
 * refresh, at most `NETWORK_ANSWER_MS`, then falls back to defaults; a lost
 * session then still goes to sign-in.
 */
export const loadSettings = async (request: Request, userId: string): Promise<MySettings> => {
  const plan = settingsPlan({ cached: readCache(userId) !== null, pending: readPending(userId) });
  const refreshed = sharedRefresh(request, userId, plan.send);
  if (plan.answer === "cache") {
    refreshed.catch(() => undefined);
    return publish(userId);
  }
  await withTimeout(refreshed, NETWORK_ANSWER_MS, () => "timedOut");
  return publish(userId);
};

/**
 * The settings this device knows now, without asking the server: the cached
 * copy with pending changes on top (or defaults). For screens that can't
 * wait for a loader; a loader's `loadSettings` has already refreshed the
 * cache by the time they render. A screen that stays up while a refresh
 * lands (the /app header) reads `useCachedSettings` instead.
 */
export const cachedSettings = (userId: string): MySettings =>
  merge(readCache(userId) ?? DEFAULTS, readPending(userId) ?? {});

/** The last `cachedSettings` each user's `useCachedSettings` read, so a snapshot stays one object until it changes. */
const snapshots = new Map<string, { json: string; settings: MySettings }>();

const cachedSnapshot = (userId: string): MySettings => {
  const settings = cachedSettings(userId);
  const json = JSON.stringify(settings);
  const last = snapshots.get(userId);
  if (last?.json === json) return last.settings;
  snapshots.set(userId, { json, settings });
  return settings;
};

/**
 * `cachedSettings`, live: for screens with no loader of their own (the /app
 * header), it re-renders when the settings store publishes a change (a
 * background refresh bringing another device's change, a save here).
 */
export const useCachedSettings = (userId: string): MySettings =>
  useSyncExternalStore(
    subscribeSettings,
    () => cachedSnapshot(userId),
    () => cachedSnapshot(userId),
  );

/** Forget every cached copy of settings, and every pending change, on this device (sign-out). */
export const forgetSettings = () => {
  forgotten++;
  refreshing.clear();
  published.clear();
  snapshots.clear();
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith(PREFIX) || key.startsWith(PENDING_PREFIX)) localStorage.removeItem(key);
  } catch {
    // Nothing cached.
  }
};
