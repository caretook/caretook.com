import { useEffect } from "react";

// The records a user last opened on this device (providers, medications,
// notes and events), so the todo link box can suggest them before anything
// is typed (B-947). Ids only, newest first, per device and per user, in
// localStorage (every access may throw: private mode, storage disabled; then
// there are none). Never sent to the server. Sign-out forgets them all
// (`forgetUserData`).

const PREFIX = "caretook:recentlyViewed:";

/** How many recently viewed records are kept. */
export const RECENTLY_VIEWED_MAX = 10;

export const RECENTLY_VIEWED_TYPES = ["provider", "medication", "note", "event"] as const;
export type RecentlyViewedType = (typeof RECENTLY_VIEWED_TYPES)[number];

/** A record opened: what it is and its id. */
export type ViewedRecord = { type: RecentlyViewedType; id: string };

const storageKey = (userId: string) => `${PREFIX}${userId}`;

const sameRecord = (a: ViewedRecord, b: ViewedRecord) => a.type === b.type && a.id === b.id;

const isViewedRecord = (value: unknown): value is ViewedRecord => {
  if (typeof value !== "object" || value === null) return false;
  const { type, id } = value as Record<string, unknown>;
  return (
    typeof id === "string" &&
    id !== "" &&
    typeof type === "string" &&
    (RECENTLY_VIEWED_TYPES as readonly string[]).includes(type)
  );
};

const parse = (raw: string | null): ViewedRecord[] => {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter(isViewedRecord)
      .map(({ type, id }) => ({ type, id }))
      .slice(0, RECENTLY_VIEWED_MAX);
  } catch {
    return [];
  }
};

/** `record` first, then the earlier ones without it, at most ten. Pure. */
export const withViewed = (recent: readonly ViewedRecord[], record: ViewedRecord): ViewedRecord[] => [
  { type: record.type, id: record.id },
  ...recent.filter((r) => !sameRecord(r, record)).slice(0, RECENTLY_VIEWED_MAX - 1),
];

/** `userId`'s recently viewed records on this device, newest first. */
export const recentlyViewed = (userId: string): ViewedRecord[] => {
  try {
    return parse(localStorage.getItem(storageKey(userId)));
  } catch {
    return [];
  }
};

/** Record that `userId` opened `record`: a repeat moves to the top. */
export const recordView = (userId: string, record: ViewedRecord) => {
  try {
    const next = withViewed(recentlyViewed(userId), record);
    localStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    // Storage unavailable: nothing recently viewed.
  }
};

/** Forget every user's recently viewed records on this device (sign-out). */
export const forgetRecentlyViewed = () => {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key);
  } catch {
    // Nothing remembered.
  }
};

/**
 * Record a page's record as viewed by `userId` (the page's `useGroup()`
 * user; passed in so this module stays pure enough for unit tests), once it
 * shows a live one: pass `null` while it's deleted (or not yet saved), and
 * nothing is recorded.
 */
export function useRecordView(userId: string, type: RecentlyViewedType, id: string | null) {
  useEffect(() => {
    if (id) recordView(userId, { type, id });
  }, [userId, type, id]);
}
