import type { DeviceToggle } from "./simpleMode";

import { useCallback, useSyncExternalStore } from "react";

// The timeline's simple/full toggle: per device, per user and per group, in
// localStorage (every access may throw: private mode, storage disabled), so
// it never leaves the device. Changing your own simple-mode setting clears
// your toggles (`clearToggles`); sign-out forgets them all (`forgetToggles`).
// Components on one page (the /app header and the timeline) share it live.

const PREFIX = "caretook:simpleMode:";
const keyOf = (userId: string, groupId: string) => `${PREFIX}${userId}:${groupId}`;

/** Without storage, a toggle still works for the page's life. */
const memory = new Map<string, "simple" | "full">();

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** This device's toggle for `userId` in `groupId`, if they've used it. */
export const readToggle = (userId: string, groupId: string): DeviceToggle => {
  try {
    const value = localStorage.getItem(keyOf(userId, groupId));
    return value === "simple" || value === "full" ? value : null;
  } catch {
    return null;
  }
};

/** Switch the timeline to simple or full on this device. */
export const setToggle = (userId: string, groupId: string, value: "simple" | "full") => {
  try {
    localStorage.setItem(keyOf(userId, groupId), value);
  } catch {
    // Storage unavailable: the toggle lasts until the page goes.
    memory.set(keyOf(userId, groupId), value);
  }
  notify();
};

const removeWhere = (match: (key: string) => boolean) => {
  try {
    for (const key of Object.keys(localStorage)) if (match(key)) localStorage.removeItem(key);
  } catch {
    // Nothing stored.
  }
  for (const key of [...memory.keys()]) if (match(key)) memory.delete(key);
  notify();
};

/** Forget `userId`'s toggles in every group (their own setting changed). */
export const clearToggles = (userId: string) => removeWhere((key) => key.startsWith(`${PREFIX}${userId}:`));

/** Forget every toggle on this device (sign-out). */
export const forgetToggles = () => removeWhere((key) => key.startsWith(PREFIX));

/** The toggle, live, and a setter. */
export function useDeviceToggle(userId: string, groupId: string) {
  const value = useSyncExternalStore(
    subscribe,
    () => memory.get(keyOf(userId, groupId)) ?? readToggle(userId, groupId),
    () => null,
  );
  const set = useCallback((next: "simple" | "full") => setToggle(userId, groupId, next), [userId, groupId]);
  return [value, set] as const;
}
