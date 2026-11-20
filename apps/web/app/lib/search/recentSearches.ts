import { useMemo, useSyncExternalStore } from "react";

// The last few searches a user ran on this device, so the empty search page
// can offer them again. Per device and per user, in localStorage (every
// access may throw: private mode, storage disabled; then there are none).
// Never sent to the server. Sign-out forgets them all.

const PREFIX = "caretook:recentSearches:";

/** How many recent searches are kept (and shown). */
export const RECENT_SEARCHES_MAX = 5;

const storageKey = (userId: string) => `${PREFIX}${userId}`;

/** A search as it's kept: trimmed, with runs of spaces made one. */
export const normalizeSearch = (q: string) => q.trim().replace(/\s+/g, " ");

const parse = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter((q): q is string => typeof q === "string" && q.trim() !== "")
      .slice(0, RECENT_SEARCHES_MAX);
  } catch {
    return [];
  }
};

/** `q` first, then the earlier ones without it (case ignored), at most five. Pure. */
export const withRecentSearch = (recent: readonly string[], q: string): string[] => {
  const search = normalizeSearch(q);
  if (!search) return [...recent];
  const key = search.toLowerCase();
  return [search, ...recent.filter((r) => normalizeSearch(r).toLowerCase() !== key)].slice(
    0,
    RECENT_SEARCHES_MAX,
  );
};

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const readRaw = (userId: string): string | null => {
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
};

/** `userId`'s recent searches on this device, newest first. */
export const recentSearches = (userId: string): string[] => parse(readRaw(userId));

/**
 * Record that `userId` used the search `q` (left the field with it, opened
 * one of its results, or tapped it as a recent search). Blank text is
 * ignored; a repeat moves to the top.
 */
export const recordSearch = (userId: string, q: string) => {
  if (!normalizeSearch(q)) return;
  try {
    const next = withRecentSearch(recentSearches(userId), q);
    localStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    // Storage unavailable: no recent searches.
  }
  notify();
};

/** Forget every user's recent searches on this device (sign-out). */
export const forgetRecentSearches = () => {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key);
  } catch {
    // Nothing remembered.
  }
  notify();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(PREFIX)) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};

const serverSnapshot = () => null;

/** `userId`'s recent searches, newest first, updated as searches are recorded (in any tab). */
export function useRecentSearches(userId: string): string[] {
  const raw = useSyncExternalStore(subscribe, () => readRaw(userId), serverSnapshot);
  return useMemo(() => parse(raw), [raw]);
}
