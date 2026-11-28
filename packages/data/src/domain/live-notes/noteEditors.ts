// Who is typing in a live document right now ("recent editors"). Client-safe
// and pure: the entry page's avatars, the timeline's live dot and the Live
// now banner all use `recentEditors`, and compaction uses `mergeEditors`.
//
// The signal has two sources, because compaction deletes updates:
//   - `note_document.editors`: `{ [userId]: lastEditAt }`, written only by
//     compaction, from the authors of the updates it folds in;
//   - the pending `note_update` rows (`createdBy`, `createdAt`), not yet
//     compacted.
// Times come from the server (an update's `created_at` is set when it's
// stored) or, for a device's own unsynced rows, its clock. A small skew is fine.

/** `{ [userId]: lastEditAt }`, ISO 8601. */
export type NoteEditors = Record<string, string>;

/** One edit: an update's author and time (any timestamp form Postgres or PowerSync produces). */
export type NoteEdit = { createdBy: string | null | undefined; createdAt: string | null | undefined };

export type RecentEditor = { userId: string; lastEditAt: string };

/** Someone counts as "typing now" for this long after their last edit… */
export const RECENT_EDITORS_WINDOW_MS = 2 * 60_000;
/** …and screens re-check on this timer, so the signal expires without new rows. */
export const RECENT_EDITORS_TICK_MS = 15_000;

const TIMESTAMP_RE =
  /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

/**
 * Milliseconds since the epoch for a timestamp as Postgres
 * (`2026-11-17 10:00:00.000+00`), PowerSync (`2026-11-17T10:00:00.000000Z`)
 * or JavaScript writes it. Null when it isn't one.
 */
export const parseEditTime = (value: unknown): number | null => {
  if (typeof value !== "string" || !value) return null;
  const m = TIMESTAMP_RE.exec(value.trim());
  if (!m) return null;
  const ms = (m[3] ?? "").padEnd(3, "0").slice(0, 3);
  let zone = (m[4] ?? "Z").toUpperCase();
  if (/^[+-]\d{2}$/.test(zone)) zone += ":00";
  else if (/^[+-]\d{4}$/.test(zone)) zone = `${zone.slice(0, 3)}:${zone.slice(3)}`;
  const t = Date.parse(`${m[1]}T${m[2]}.${ms}${zone}`);
  return Number.isNaN(t) ? null : t;
};

/**
 * `editors` as stored: a jsonb object on the server, JSON text on the device.
 * Anything that isn't a user id → timestamp pair is dropped.
 */
export const parseNoteEditors = (value: unknown): NoteEditors => {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: NoteEditors = {};
  for (const [userId, at] of Object.entries(raw)) {
    const t = parseEditTime(at);
    if (userId && t !== null) out[userId] = new Date(t).toISOString();
  }
  return out;
};

/** `editors` plus each edit's author and time, keeping the latest time per user (ISO 8601). */
export const mergeEditors = (editors: NoteEditors, edits: readonly NoteEdit[]): NoteEditors => {
  const latest = new Map<string, number>();
  const add = (userId: string | null | undefined, at: unknown) => {
    const t = parseEditTime(at);
    if (!userId || t === null) return;
    if (t > (latest.get(userId) ?? -Infinity)) latest.set(userId, t);
  };
  for (const [userId, at] of Object.entries(editors)) add(userId, at);
  for (const edit of edits) add(edit.createdBy, edit.createdAt);
  return Object.fromEntries([...latest].map(([userId, t]) => [userId, new Date(t).toISOString()]));
};

/**
 * Who edited the document within `windowMs` of `now`, most recent first.
 * Combines the compacted `editors` with the pending updates (the latest time
 * per user wins). `excludeUserId` (the viewer) never appears: nobody is shown
 * their own typing. An edit up to `windowMs` in the future (another device's
 * clock running fast) still counts.
 */
export const recentEditors = ({
  editors,
  pending = [],
  now,
  windowMs = RECENT_EDITORS_WINDOW_MS,
  excludeUserId,
}: {
  editors: NoteEditors | null | undefined;
  pending?: readonly NoteEdit[];
  now: number;
  windowMs?: number;
  excludeUserId?: string | null;
}): RecentEditor[] =>
  Object.entries(mergeEditors(editors ?? {}, pending))
    .map(([userId, lastEditAt]) => ({ userId, lastEditAt, t: Date.parse(lastEditAt) }))
    .filter(({ userId, t }) => userId !== excludeUserId && Math.abs(now - t) <= windowMs)
    .sort((a, b) => b.t - a.t || a.userId.localeCompare(b.userId))
    .map(({ userId, lastEditAt }) => ({ userId, lastEditAt }));
