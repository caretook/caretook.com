import type { ApiOutputs } from "./rpc";

import { ORPCError } from "@orpc/client";
import { DEFAULT_SIMPLE_MODE_SETTING, DEFAULT_TIMELINE_VIEW, DEFAULT_UNITS } from "@caretook/data/schema";
import { load } from "./api";
import { rpc } from "./rpc";

// The signed-in user's settings (units, timeline layout, simple mode). They live on
// `user.preferences`, which isn't synced, so the last copy is cached on the
// device: screens still show the right units offline.
//
// A change made offline is also kept as *pending* (per user) until the server
// has it: `saveSettings` tries at once, and `loadSettings` sends what's left
// before reading the server's copy. Last write wins: a pending change from
// this device overwrites one made on another device in the meantime, which is
// fine for display preferences.

export type MySettings = Pick<ApiOutputs["me"]["get"], "units" | "timelineView" | "simpleMode">;
/** A change to some settings. `units` may name only some measures. */
export type SettingsChange = Partial<Omit<MySettings, "units">> & { units?: Partial<MySettings["units"]> };

const DEFAULTS: MySettings = {
  units: DEFAULT_UNITS,
  timelineView: DEFAULT_TIMELINE_VIEW,
  simpleMode: DEFAULT_SIMPLE_MODE_SETTING,
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
  return next;
};

const readCache = (userId: string): MySettings | null => {
  const cached = readJson<SettingsChange>(cacheKey(userId));
  return cached ? merge(DEFAULTS, cached) : null;
};

const readPending = (userId: string): SettingsChange | null => readJson<SettingsChange>(pendingKey(userId));

/** Forget the pending fields that were sent, unless they've changed again since. */
const clearPending = (userId: string, sent: SettingsChange) => {
  const pending = readPending(userId);
  if (!pending) return;
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const left: SettingsChange = { ...pending };
  if ("timelineView" in sent && same(left.timelineView, sent.timelineView)) delete left.timelineView;
  if ("simpleMode" in sent && same(left.simpleMode, sent.simpleMode)) delete left.simpleMode;
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

/** Remember settings on this device (after loading them, or after a change). */
export const cacheSettings = (userId: string, settings: SettingsChange) => {
  writeJson(cacheKey(userId), merge(readCache(userId) ?? DEFAULTS, settings));
};

/**
 * Change some settings: cached and marked pending at once, then sent.
 * Resolves `"saved"` when the server has them, or `"pending"` when offline
 * (the next online `loadSettings` sends them). Any other failure rejects
 * with the API's error (use `toActionResult` for a form); a refused change
 * is no longer pending, though the cache keeps it until the next load.
 */
export const saveSettings = async (userId: string, change: SettingsChange): Promise<"saved" | "pending"> => {
  cacheSettings(userId, change);
  writeJson(pendingKey(userId), merge(readPending(userId) ?? {}, change));
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
 * Settings for a clientLoader: fresh from the server when online (after
 * sending any pending change), else the cached copy with pending changes on
 * top (or defaults). A lost session still goes to sign-in.
 */
export const loadSettings = async (request: Request, userId: string): Promise<MySettings> => {
  const offline = () => merge(readCache(userId) ?? DEFAULTS, readPending(userId) ?? {});
  const pending = readPending(userId);
  if (pending) {
    try {
      await load(request, rpc.me.updatePreferences(pending));
      clearPending(userId, pending);
    } catch (e) {
      if (isNetworkError(e)) return offline();
      // The server refused the change (say, a value this version no longer
      // accepts): drop it and use the server's copy.
      if (!(e instanceof ORPCError) || isSignedOut(e)) throw e;
      clearPending(userId, pending);
    }
  }
  try {
    const me = await load(request, rpc.me.get());
    const settings = { units: me.units, timelineView: me.timelineView, simpleMode: me.simpleMode };
    cacheSettings(userId, settings);
    return settings;
  } catch (e) {
    // Anything but a lost connection (a sign-in redirect, an API error) is real.
    if (!isNetworkError(e)) throw e;
    return offline();
  }
};

/**
 * The settings this device knows now, without asking the server: the cached
 * copy with pending changes on top (or defaults). For screens that can't
 * wait for a loader, such as the /app header; a loader's `loadSettings` has
 * already refreshed the cache by the time they render.
 */
export const cachedSettings = (userId: string): MySettings =>
  merge(readCache(userId) ?? DEFAULTS, readPending(userId) ?? {});

/** Forget every cached copy of settings, and every pending change, on this device (sign-out). */
export const forgetSettings = () => {
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith(PREFIX) || key.startsWith(PENDING_PREFIX)) localStorage.removeItem(key);
  } catch {
    // Nothing cached.
  }
};
