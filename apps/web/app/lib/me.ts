import type { ApiOutputs } from "./rpc";

import { DEFAULT_TIMELINE_VIEW, DEFAULT_UNITS } from "@caretook/data/schema";
import { load } from "./api";
import { rpc } from "./rpc";

// The signed-in user's settings (units, timeline layout). They live on
// `user.preferences`, which isn't synced, so the last copy is cached on the
// device: screens still show the right units offline.

export type MySettings = Pick<ApiOutputs["me"]["get"], "units" | "timelineView">;

const DEFAULTS: MySettings = { units: DEFAULT_UNITS, timelineView: DEFAULT_TIMELINE_VIEW };

const cacheKey = (userId: string) => `caretook:settings:${userId}`;

const readCache = (userId: string): MySettings | null => {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<MySettings>) } : null;
  } catch {
    return null;
  }
};

/** Remember settings on this device (after loading them, or after a change). */
export const cacheSettings = (userId: string, settings: Partial<MySettings>) => {
  try {
    const next = { ...(readCache(userId) ?? DEFAULTS), ...settings };
    localStorage.setItem(cacheKey(userId), JSON.stringify(next));
  } catch {
    // Storage unavailable: the defaults apply offline.
  }
};

/**
 * Settings for a clientLoader: fresh from the server when online, else the
 * cached copy (or defaults). A lost session still goes to sign-in.
 */
export const loadSettings = async (request: Request, userId: string): Promise<MySettings> => {
  try {
    const me = await load(request, rpc.me.get());
    const settings = { units: me.units, timelineView: me.timelineView };
    cacheSettings(userId, settings);
    return settings;
  } catch (e) {
    // fetch fails with a TypeError when there's no connection. Anything else
    // (a sign-in redirect, an API error) is real and propagates.
    if (!(e instanceof TypeError)) throw e;
    return readCache(userId) ?? DEFAULTS;
  }
};

/** Forget every cached copy of settings on this device (sign-out). */
export const forgetSettings = () => {
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith("caretook:settings:")) localStorage.removeItem(key);
  } catch {
    // Nothing cached.
  }
};
