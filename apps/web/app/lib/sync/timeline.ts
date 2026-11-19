import type {
  TimelineEntryContent,
  TimelineEntryDetails,
  TimelineEntryKind,
  TimelineEntryUpdateInput,
  VitalReading,
} from "@caretook/data/schema";
import type { ActionResult } from "../api";
import type { GroupMember, LatestVital, MyGroup, TimelineEntry } from "../rpc";
import type { SyncDb } from "./index";

import { isKnownReading, timelineEntryContentZSchema } from "@caretook/data/schema";
import { eq } from "drizzle-orm";
import { isEntryKind } from "../entryDisplay";
import { timelineEntries } from "./schema";

// Local reads and writes for the timeline screens. Reads are plain SQL for
// `useLiveQuery`; rows map to the same shapes the oRPC API returns, so the
// display components don't know where data came from.
//
// Writes land in local SQLite at once and queue for upload (sync.upload),
// where the services validate them again.

export const WRITER_ROLES = ["owner", "admin", "caretaker"];

// ---------------------------------------------------------------------------
// Timestamps. PowerSync stores timestamptz as ISO 8601 text with
// microseconds: "2026-11-17T21:45:25.229000Z" (observed with service 1.28;
// its docs show a space instead of the T). Local writes use exactly that
// text, so rows sort correctly as strings before and after the server's copy
// arrives.
// ---------------------------------------------------------------------------

/** ISO 8601 (any precision) → PowerSync's SQLite text, at microsecond precision. */
export const toLocalTimestamp = (iso: string | Date) => new Date(iso).toISOString().replace(/Z$/, "000Z");

const TIMESTAMP_RE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * PowerSync's SQLite text → ISO 8601 in UTC, at millisecond precision. Parsed
 * by hand so engines that reject 6 fractional digits (or a space) still work.
 */
export const fromLocalTimestamp = (value: string) => {
  const m = TIMESTAMP_RE.exec(value);
  if (!m) return new Date(value).toISOString();
  const ms = (m[3] ?? "").padEnd(3, "0").slice(0, 3);
  return new Date(`${m[1]}T${m[2]}.${ms}${m[4] ?? "Z"}`).toISOString();
};

export const nowTimestamp = () => toLocalTimestamp(new Date());

const parseJson = (value: string | null): unknown => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type EntryRow = {
  id: string;
  group_id: string | null;
  recipient_id: string | null;
  kind: string | null;
  occurred_at: string | null;
  time_zone: string | null;
  title: string | null;
  body: string | null;
  details: string | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
};

/**
 * A local row in the API's TimelineEntry shape, or null for a row this
 * build can't show (a kind from a newer app version, a half-synced row).
 */
export const toTimelineEntry = (row: EntryRow): TimelineEntry | null => {
  if (!isEntryKind(row.kind) || !row.occurred_at || !row.group_id) return null;
  return {
    id: row.id,
    groupId: row.group_id,
    recipientId: row.recipient_id ?? "",
    kind: row.kind,
    occurredAt: fromLocalTimestamp(row.occurred_at),
    timeZone: row.time_zone ?? "UTC",
    title: row.title,
    body: row.body,
    details: parseJson(row.details) as TimelineEntryDetails | null,
    deletedAt: row.deleted_at ? fromLocalTimestamp(row.deleted_at) : null,
    createdAt: row.created_at ? fromLocalTimestamp(row.created_at) : "",
    updatedAt: row.updated_at ? fromLocalTimestamp(row.updated_at) : "",
    createdBy: row.created_by ?? "",
    updatedBy: row.updated_by ?? "",
  };
};

export const toTimelineEntries = (rows: EntryRow[]) =>
  rows.map(toTimelineEntry).filter((e): e is TimelineEntry => e !== null);

// ---------------------------------------------------------------------------
// Queries: { sql, params } pairs for useLiveQuery and loaders.
// ---------------------------------------------------------------------------

export type LocalQuery = { sql: string; params: unknown[] };

/** The timeline's filters, as the queries take them (`TimelineFilters` in `lib/timelineFilters.ts`). */
export type EntryFilters = { kind: TimelineEntryKind | null; author: string | null };

/**
 * The timeline's window: one group's live entries under the filters, newest
 * first, as the tail of a `SELECT … FROM timeline_entry`. `entriesQuery` and
 * `timelineLinksQuery` are both built on it, so the "with …" lines always
 * cover exactly the listed entries. It asks for one row more than `limit`, so
 * the screen knows whether there are older entries.
 */
export const entryWindow = (groupId: string, filters: EntryFilters, limit: number): LocalQuery => {
  const conditions = ["group_id = ?", "deleted_at IS NULL"];
  const params: unknown[] = [groupId];
  if (filters.kind) {
    conditions.push("kind = ?");
    params.push(filters.kind);
  }
  if (filters.author) {
    conditions.push("created_by = ?");
    params.push(filters.author);
  }
  return {
    sql: `FROM timeline_entry WHERE ${conditions.join(" AND ")} ORDER BY occurred_at DESC, id DESC LIMIT ?`,
    params: [...params, limit + 1],
  };
};

/** One group's entries under the filters, newest first (`entryWindow`). */
export const entriesQuery = (groupId: string, filters: EntryFilters, limit: number): LocalQuery => {
  const window = entryWindow(groupId, filters, limit);
  return { sql: `SELECT * ${window.sql}`, params: window.params };
};

export type GroupRow = {
  id: string;
  name: string | null;
  role: string | null;
  recipient_id: string | null;
  recipient_name: string | null;
  recipient_preferred_name: string | null;
};

/** The groups `userId` belongs to, with their role and the recipient. */
export const myGroupsQuery = (userId: string): LocalQuery => ({
  sql: `SELECT g.id, g.name, m.role, r.id AS recipient_id, r.name AS recipient_name,
               r.preferred_name AS recipient_preferred_name
        FROM care_group g
        JOIN care_group_member m ON m.group_id = g.id AND m.user_id = ?
        LEFT JOIN care_recipient r ON r.group_id = g.id
        ORDER BY g.name, g.id`,
  params: [userId],
});

/** One group `userId` belongs to (no row when they aren't a member, or it isn't on the device). */
export const myGroupQuery = (userId: string, groupId: string): LocalQuery => ({
  sql: `SELECT g.id, g.name, m.role, r.id AS recipient_id, r.name AS recipient_name,
               r.preferred_name AS recipient_preferred_name
        FROM care_group g
        JOIN care_group_member m ON m.group_id = g.id AND m.user_id = ?
        LEFT JOIN care_recipient r ON r.group_id = g.id
        WHERE g.id = ?`,
  params: [userId, groupId],
});

export const toMyGroup = (row: GroupRow): MyGroup => ({
  id: row.id,
  name: row.name ?? "",
  role: (row.role ?? null) as MyGroup["role"],
  recipient: row.recipient_id
    ? { id: row.recipient_id, displayName: row.recipient_preferred_name || row.recipient_name || "" }
    : null,
});

export type MemberRow = { user_id: string; role: string | null; name: string | null; image: string | null };

export const membersQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT m.user_id, m.role, u.name, u.image
        FROM care_group_member m LEFT JOIN "user" u ON u.id = m.user_id
        WHERE m.group_id = ?`,
  params: [groupId],
});

export const toMember = (row: MemberRow): GroupMember => ({
  userId: row.user_id,
  role: (row.role ?? "viewer") as GroupMember["role"],
  name: row.name,
  image: row.image,
});

export type ReadingRow = { entry_id: string; occurred_at: string; reading: string };

/** Every vital reading in the group, newest first; `toLatestVitals` keeps the newest per type. */
export const readingsQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT e.id AS entry_id, e.occurred_at, r.value AS reading
        FROM timeline_entry e, json_each(e.details, '$.readings') r
        WHERE e.group_id = ? AND e.kind = 'vital' AND e.deleted_at IS NULL
        ORDER BY e.occurred_at DESC, e.id DESC`,
  params: [groupId],
});

/** The newest reading of each known type, most recent first (like `timeline.latestVitals`). */
export const toLatestVitals = (rows: ReadingRow[]): LatestVital[] => {
  const seen = new Set<string>();
  const latest: LatestVital[] = [];
  for (const row of rows) {
    const reading = parseJson(row.reading) as { type?: unknown } | null;
    if (!reading || !isKnownReading(reading as VitalReading)) continue;
    const type = String(reading.type);
    if (seen.has(type)) continue;
    seen.add(type);
    latest.push({
      entryId: row.entry_id,
      occurredAt: fromLocalTimestamp(row.occurred_at),
      reading: reading as VitalReading,
    });
  }
  return latest;
};

export const readRows = <T>(db: SyncDb, query: LocalQuery) => db.powersync.getAll<T>(query.sql, query.params);

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export const invalid = (error: { issues: { path: PropertyKey[]; message: string }[] }): ActionResult => ({
  ok: false,
  error: "The timeline entry is invalid",
  issues: error.issues.map(({ path, message }) => ({ path: path.map(String).join("."), message })),
});

export const forbidden: ActionResult = {
  ok: false,
  error: "You don't have permission to do that.",
  issues: [],
};
export const missing: ActionResult = {
  ok: false,
  error: "That entry is gone. It may have been deleted.",
  issues: [],
};

/** The actor's role in the group and the group's recipient, from the local copy. */
export const groupFor = async (db: SyncDb, groupId: string) => {
  const rows = await readRows<GroupRow>(db, myGroupsQuery(db.userId));
  const row = rows.find((g) => g.id === groupId);
  return row ? toMyGroup(row) : null;
};

export const contentColumns = (content: Omit<TimelineEntryContent, "kind">) => ({
  occurredAt: toLocalTimestamp(content.occurredAt),
  timeZone: content.timeZone,
  title: content.title ?? null,
  body: content.body ?? null,
  details: content.details ? JSON.stringify(content.details) : null,
});

/** Add an entry on this device. It syncs when the device is online. */
export const createEntry = async (db: SyncDb, groupId: string, input: unknown): Promise<ActionResult> => {
  const group = await groupFor(db, groupId);
  if (!group?.role || !WRITER_ROLES.includes(group.role)) return forbidden;
  if (!group.recipient) return { ok: false, error: "This care group has no care recipient yet", issues: [] };

  const parsed = timelineEntryContentZSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const now = nowTimestamp();
  await db.drizzle.insert(timelineEntries).values({
    id: crypto.randomUUID(),
    groupId,
    recipientId: group.recipient.id,
    kind: parsed.data.kind,
    ...contentColumns(parsed.data),
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: db.userId,
    updatedBy: db.userId,
  });
  return { ok: true };
};

const existingEntry = async (db: SyncDb, id: string) => {
  const rows = await readRows<EntryRow>(db, {
    sql: "SELECT * FROM timeline_entry WHERE id = ? AND deleted_at IS NULL",
    params: [id],
  });
  return rows[0] ? toTimelineEntry(rows[0]) : null;
};

/**
 * Edit an entry's content. Only content columns are written: group,
 * recipient and kind are fixed, and the server refuses changes to them.
 */
export const updateEntry = async (
  db: SyncDb,
  id: string,
  patch: TimelineEntryUpdateInput,
): Promise<ActionResult> => {
  const entry = await existingEntry(db, id);
  if (!entry) return missing;
  const group = await groupFor(db, entry.groupId);
  if (!group?.role || !WRITER_ROLES.includes(group.role)) return forbidden;

  const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  const merged = timelineEntryContentZSchema.safeParse({
    kind: entry.kind,
    title: entry.title,
    body: entry.body,
    occurredAt: entry.occurredAt,
    timeZone: entry.timeZone,
    details: entry.details,
    ...defined,
  });
  if (!merged.success) return invalid(merged.error);

  await db.drizzle
    .update(timelineEntries)
    .set({ ...contentColumns(merged.data), updatedAt: nowTimestamp(), updatedBy: db.userId })
    .where(eq(timelineEntries.id, id));
  return { ok: true };
};

/** Soft delete, so the deletion syncs to everyone's devices. */
export const removeEntry = async (db: SyncDb, id: string): Promise<ActionResult> => {
  const entry = await existingEntry(db, id);
  if (!entry) return { ok: true };
  const group = await groupFor(db, entry.groupId);
  if (!group?.role || !WRITER_ROLES.includes(group.role)) return forbidden;

  const now = nowTimestamp();
  await db.drizzle
    .update(timelineEntries)
    .set({ deletedAt: now, updatedAt: now, updatedBy: db.userId })
    .where(eq(timelineEntries.id, id));
  return { ok: true };
};
