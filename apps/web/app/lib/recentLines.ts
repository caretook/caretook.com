import { useMemo, useSyncExternalStore } from "react";

// Quick entry's recent lines: the last few lines a user saved in a group on
// this device, offered again as one-tap chips that fill the box. Per device,
// user and group, in localStorage (every access may throw: private mode,
// storage disabled; then there are none). Recorded on Save only, never sent
// to the server, and forgotten at sign-out (`wipeDevice`).

const PREFIX = "caretook:recentLines:";

/** How many recent lines are kept (and offered). */
export const RECENT_LINES_MAX = 8;

const storageKey = (userId: string, groupId: string) => `${PREFIX}${userId}:${groupId}`;

/** A line as it's kept: trimmed, with runs of spaces made one. */
export const normalizeLine = (line: string) => line.trim().replace(/\s+/g, " ");

const parse = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter((line): line is string => typeof line === "string" && line.trim() !== "")
      .slice(0, RECENT_LINES_MAX);
  } catch {
    return [];
  }
};

/** `line` first, then the earlier ones without it (case and spacing ignored), at most eight. Pure. */
export const withRecentLine = (recent: readonly string[], line: string): string[] => {
  const kept = normalizeLine(line);
  if (!kept) return [...recent];
  const key = kept.toLowerCase();
  return [kept, ...recent.filter((r) => normalizeLine(r).toLowerCase() !== key)].slice(0, RECENT_LINES_MAX);
};

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const readRaw = (userId: string, groupId: string): string | null => {
  try {
    return localStorage.getItem(storageKey(userId, groupId));
  } catch {
    return null;
  }
};

/** `userId`'s recent lines in `groupId` on this device, newest first. */
export const recentLines = (userId: string, groupId: string): string[] => parse(readRaw(userId, groupId));

/** Record that `userId` saved `line` in `groupId`. Blank text is ignored; a repeat moves to the top. */
export const recordLine = (userId: string, groupId: string, line: string) => {
  if (!normalizeLine(line)) return;
  try {
    const next = withRecentLine(recentLines(userId, groupId), line);
    localStorage.setItem(storageKey(userId, groupId), JSON.stringify(next));
  } catch {
    // Storage unavailable: no recent lines.
  }
  notify();
};

/** Forget every user's recent lines on this device, in every group (sign-out). */
export const forgetRecentLines = () => {
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

/** `userId`'s recent lines in `groupId`, newest first, updated as lines are saved (in any tab). */
export function useRecentLines(userId: string, groupId: string): string[] {
  const raw = useSyncExternalStore(subscribe, () => readRaw(userId, groupId), serverSnapshot);
  return useMemo(() => parse(raw), [raw]);
}
