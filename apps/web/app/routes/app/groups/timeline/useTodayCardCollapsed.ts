import { useCallback, useSyncExternalStore } from "react";

// Whether the Today card is collapsed to its one-line summary (B-185): a
// per-device convenience in localStorage (no health data, so it isn't cleared
// at sign-out). With no stored choice the card is collapsed unless something
// needs attention (`attentionKey`). A tap stores the choice with the key it
// was made at; once the key changes (a new overdue dose, an appointment now
// within 2 h, or nothing left to attend to) the default applies again. Every
// access may throw (private mode, storage disabled); then the choice lasts
// until the page reloads.

const KEY = "caretook:todayCard:collapsed";

type Choice = { collapsed: boolean; key: string };

/** The server's snapshot: no storage, so the card renders open. */
const SERVER = "\u0000server";

const listeners = new Set<() => void>();
let fallback: string | null = null;

/** The raw stored value (a string, so the snapshot is stable). */
const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return fallback;
  }
};

const parse = (raw: string | null): Choice | null => {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === "object" &&
      "collapsed" in value &&
      typeof value.collapsed === "boolean" &&
      "key" in value &&
      typeof value.key === "string"
    )
      return { collapsed: value.collapsed, key: value.key };
  } catch {
    // An older value ("1") or junk: no choice.
  }
  return null;
};

const write = (choice: Choice) => {
  const raw = JSON.stringify(choice);
  fallback = raw;
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    // Kept in memory only (`fallback`).
  }
  listeners.forEach((l) => l());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * The Today card's collapsed state on this device, and its setter, given
 * what needs attention now (`attentionKey`, empty for nothing; null while
 * the rows are still skeletons): collapsed by default unless something
 * does, or the stored choice while the key is the one it was made at. Open
 * on the server; while the rows are unknown, the last choice (else open), so
 * a first visit's skeletons hold the open card's place.
 */
export function useTodayCardCollapsed(attention: string | null): [boolean, (collapsed: boolean) => void] {
  const raw = useSyncExternalStore(subscribe, read, () => SERVER);
  const choice = raw === SERVER ? null : parse(raw);
  const collapsed =
    raw === SERVER
      ? false
      : attention === null
        ? (choice?.collapsed ?? false)
        : choice && choice.key === attention
          ? choice.collapsed
          : attention === "";
  return [
    collapsed,
    useCallback((next: boolean) => write({ collapsed: next, key: attention ?? "" }), [attention]),
  ];
}
