import { useCallback, useSyncExternalStore } from "react";

// Whether the Today card is collapsed to its one-line summary: a per-device
// convenience in localStorage (no health data, so it isn't cleared at
// sign-out). Every access may throw (private mode, storage disabled); then
// the card starts open and the choice lasts until the page reloads.

const KEY = "caretook:todayCard:collapsed";

const listeners = new Set<() => void>();
let fallback = false;

const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return fallback;
  }
};

const write = (collapsed: boolean) => {
  fallback = collapsed;
  try {
    if (collapsed) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // Kept in memory only (`fallback`).
  }
  listeners.forEach((l) => l());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The Today card's collapsed state on this device, and its setter. Open on the server. */
export function useTodayCardCollapsed(): [boolean, (collapsed: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);
  return [collapsed, useCallback((next: boolean) => write(next), [])];
}
