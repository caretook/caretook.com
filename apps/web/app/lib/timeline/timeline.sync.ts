import type {
  TimelineEntryContent,
  TimelineEntryDetails,
  TimelineEntryKind,
  TimelineEntryUpdateInput,
  VitalReading,
} from "@caretook/data/schema";
import type { ActionResult } from "../core/api";
import type { GroupMember, LatestVital, MyGroup, TimelineEntry } from "../core/rpc";
import type { SyncDb } from "../sync/index";

import { WRITERS, isLoggerRole } from "@caretook/data/permissions";
import {
  isKnownReading,
  isSymptomDetails,
  symptomTypeId,
  timelineEntryContentZSchema,
} from "@caretook/data/schema";
import { and, eq, isNull } from "drizzle-orm";
import { changedColumns } from "../core/changedColumns";
import { isEntryKind } from "./entryDisplay";
import { addSymptomTypeIn } from "./symptomTypes.sync";
import { TIMELINE_KINDS } from "./timelineFilters";
import { timelineEntries } from "../sync/schema";
import {
  DEVICE_FUTURE_SKEW_MS,
  FUTURE_DATE_MESSAGE,
  FUTURE_KINDS,
  canChangeEntry,
  canLogEntry,
  isTooFarAhead,
} from "@caretook/data/domain";

// Local reads and writes for the timeline screens. Reads are plain SQL for
// `useLiveQuery`; rows map to the same shapes the oRPC API returns, so the
// display components don't know where data came from.
//
// Writes land in local SQLite at once and queue for upload (sync.upload),
// where the services validate them again.

/** The roles that change setup and anyone's data (the shared `WRITERS`). */
export const WRITER_ROLES: readonly string[] = WRITERS;

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
  // Appointments and reminders (optional: rows from before they synced).
  ends_at?: string | null;
  all_day?: number | null;
  place?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancel_reason?: string | null;
  rescheduled_to?: string | null;
  // Written through a member's AI assistant (connectors; optional until the device schema has it).
  via?: string | null;
  // A repeating series' visit (appointments-2; optional: rows from before they synced).
  series_id?: string | null;
  series_day?: string | null;
  series_detached?: number | null;
  // A symptom's catalog row (symptom-catalog; optional: rows from before it synced).
  symptom_type_id?: string | null;
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
    endsAt: row.ends_at ? fromLocalTimestamp(row.ends_at) : null,
    allDay: row.all_day === 1,
    place: row.place ?? null,
    cancelledAt: row.cancelled_at ? fromLocalTimestamp(row.cancelled_at) : null,
    cancelledBy: row.cancelled_by ?? null,
    cancelReason: row.cancel_reason ?? null,
    rescheduledTo: row.rescheduled_to ?? null,
    via: row.via ?? null,
    seriesId: row.series_id ?? null,
    seriesDay: row.series_day ?? null,
    seriesDetached: row.series_detached === 1,
    symptomTypeId: row.symptom_type_id ?? null,
  };
};

export const toTimelineEntries = (rows: EntryRow[]) =>
  rows.map(toTimelineEntry).filter((e): e is TimelineEntry => e !== null);

// ---------------------------------------------------------------------------
// Queries: { sql, params } pairs for useLiveQuery and loaders.
// ---------------------------------------------------------------------------

export type LocalQuery = { sql: string; params: unknown[] };

/**
 * A condition on an entry's id (`timeline_entry.id`) that the windows AND in:
 * the timeline's search (`entryMatchCondition` in `./search`, or one that
 * matches nothing while the index is preparing).
 */
export type EntryCondition = { sql: string; params: unknown[] };

/** The timeline's filters, as the queries take them (`TimelineFilters` in `lib/timeline/timelineFilters.ts`). */
export type EntryFilters = {
  kind: TimelineEntryKind | null;
  author: string | null;
  /** Only the entries this condition holds for (the search); none means every entry. */
  match?: EntryCondition | null;
  /** Only entries with a reading of this vital type (`?vital=`, under the vital kind); none means every entry. */
  vital?: string | null;
  /**
   * Only symptoms of any of these catalog rows (`?symptom=`, under the symptom
   * kind), by the stored `symptom_type_id`; none or empty means every entry.
   */
  symptoms?: readonly string[] | null;
  /**
   * Only entries carrying this tag (`?tag=`, tags PRD), by a `record_tag`
   * subquery; ANDed with `match`, never in place of it. None means every entry.
   */
  tag?: string | null;
};

/** An entry carrying one tag: its `record_tag` link (the tag's group is the entry's). */
const TAGGED_SQL =
  "timeline_entry.id IN (SELECT l.entry_id FROM record_tag l WHERE l.tag_id = ? AND l.group_id = timeline_entry.group_id)";

/**
 * The kinds the timeline shows, as SQL (`TIMELINE_KINDS`). The timeline's
 * window leaves the other kinds out here, not after loading, so a day of
 * doses never shortens a page.
 */
export const SHOWN_KINDS_SQL = `kind IN (${TIMELINE_KINDS.map((k) => `'${k}'`).join(", ")})`;

/** An entry with a reading of one vital type (`details.readings[].type`). */
const VITAL_TYPE_SQL =
  "EXISTS (SELECT 1 FROM json_each(details, '$.readings') r WHERE json_extract(r.value, '$.type') = ?)";

/**
 * The kinds the history holds back until they've started: the future kinds
 * (events) and notes, so a note stored ahead before notes became past-only
 * stays out of the timeline until its time comes.
 */
export const HISTORY_ENDS_SQL = `kind IN (${[...new Set(["note", ...FUTURE_KINDS])].map((k) => `'${k}'`).join(", ")})`;

/** The conditions every window shares: one group, live entries, the kind, author, vital-type, symptom-type and tag filters, the search. */
const filterConditions = (groupId: string, filters: EntryFilters, kinds: readonly string[] | null) => {
  const conditions = ["group_id = ?", "deleted_at IS NULL"];
  const params: unknown[] = [groupId];
  if (filters.kind) {
    conditions.push("kind = ?");
    params.push(filters.kind);
  }
  if (kinds) {
    conditions.push(`kind IN (${kinds.map(() => "?").join(", ")})`);
    params.push(...kinds);
  } else if (!filters.kind) {
    conditions.push(SHOWN_KINDS_SQL);
  }
  if (filters.author) {
    conditions.push("created_by = ?");
    params.push(filters.author);
  }
  if (filters.vital) {
    conditions.push(VITAL_TYPE_SQL);
    params.push(filters.vital);
  }
  if (filters.symptoms?.length) {
    // The stored pointer only: SQLite can't derive a name's key or id, and a filter after loading would short a page.
    conditions.push(`symptom_type_id IN (${filters.symptoms.map(() => "?").join(", ")})`);
    params.push(...filters.symptoms);
  }
  if (filters.tag) {
    conditions.push(TAGGED_SQL);
    params.push(filters.tag);
  }
  if (filters.match) {
    conditions.push(`(${filters.match.sql})`);
    params.push(...filters.match.params);
  }
  return { conditions, params };
};

/**
 * The timeline's window: one group's live entries under the filters, newest
 * first, as the tail of a `SELECT … FROM timeline_entry`. `historyWindow`
 * adds the history's end to it (the timeline reads `historyQuery` and
 * `timelineLinksQuery`, so the "with …" lines always cover exactly the
 * listed entries). It asks for one row more than `limit`, so
 * the screen knows whether there are older entries.
 */
export const entryWindow = (groupId: string, filters: EntryFilters, limit: number): LocalQuery => {
  const { conditions, params } = filterConditions(groupId, filters, null);
  return {
    sql: `FROM timeline_entry WHERE ${conditions.join(" AND ")} ORDER BY occurred_at DESC, id DESC LIMIT ?`,
    params: [...params, limit + 1],
  };
};

/**
 * The timeline's history: `entryWindow` ending at `cutoff` (`historyCutoff`
 * in `lib/appointments/upcoming`, from a once-a-minute clock). Notes and events count
 * once they've started (a stored future note waits for its time); other kinds always do (they can't be in the future
 * beyond a few minutes of skew, and a vital saved "now" must show at once).
 * Newest first, one row more than `limit`, so paging counts past items only.
 * `before` is a jump's exclusive upper bound (`jumpBound`): the window then
 * starts at the newest entry before it.
 */
export const historyWindow = (
  groupId: string,
  filters: EntryFilters,
  limit: number,
  cutoff: string,
  before?: string | null,
): LocalQuery => {
  const { conditions, params } = filterConditions(groupId, filters, null);
  conditions.push(`(NOT ${HISTORY_ENDS_SQL} OR occurred_at <= ?)`);
  params.push(toLocalTimestamp(cutoff));
  if (before) {
    conditions.push("occurred_at < ?");
    params.push(toLocalTimestamp(before));
  }
  return {
    sql: `FROM timeline_entry WHERE ${conditions.join(" AND ")} ORDER BY occurred_at DESC, id DESC LIMIT ?`,
    params: [...params, limit + 1],
  };
};

/**
 * The rows just above a jump's bound, oldest first, under the same filters
 * and cutoff as `historyWindow`: `occurred_at >= before` is that window's
 * `< before` turned over, so a row exactly at the bound is in one, never both.
 */
export const newerEdgeQuery = (
  groupId: string,
  filters: EntryFilters,
  before: string,
  cutoff: string,
  limit: number,
): LocalQuery => {
  const { conditions, params } = filterConditions(groupId, filters, null);
  conditions.push(`(NOT ${HISTORY_ENDS_SQL} OR occurred_at <= ?)`, "occurred_at >= ?");
  params.push(toLocalTimestamp(cutoff), toLocalTimestamp(before));
  return {
    sql: `SELECT occurred_at, kind, details FROM timeline_entry WHERE ${conditions.join(" AND ")} ORDER BY occurred_at ASC, id ASC LIMIT ?`,
    params: [...params, limit],
  };
};

/** How far ahead Upcoming looks before "Show later". */
export const UPCOMING_HORIZON_DAYS = 90;

const DAY_MS = 86_400_000;

/**
 * Upcoming notes and events under the filters, soonest first, starting
 * before `now` plus `horizonDays`. Uncapped: everything in the horizon.
 * Cancelled ones are included (shown struck through).
 *
 * A candidate set: it holds every item `entryTiming` (`lib/appointments/upcoming`) calls
 * upcoming or now (starting after now, ending after now, or all day and
 * starting within the last 25 hours, the longest day), and a few all-day
 * items whose day has just ended. Screens filter it through `entryTiming`
 * and sort it with `upcomingOrder` (all-day items first in their day).
 */
export const upcomingWindow = (
  groupId: string,
  filters: EntryFilters,
  now: Date,
  horizonDays = UPCOMING_HORIZON_DAYS,
): LocalQuery => {
  const { conditions, params } = filterConditions(groupId, filters, FUTURE_KINDS);
  const at = now.getTime();
  conditions.push("(occurred_at > ? OR ends_at > ? OR (all_day = 1 AND occurred_at > ?))");
  params.push(toLocalTimestamp(now), toLocalTimestamp(now), toLocalTimestamp(new Date(at - 25 * 3_600_000)));
  conditions.push("occurred_at < ?");
  params.push(toLocalTimestamp(new Date(at + horizonDays * DAY_MS)));
  return {
    sql: `FROM timeline_entry WHERE ${conditions.join(" AND ")} ORDER BY occurred_at ASC, id ASC`,
    params,
  };
};

/**
 * Past events under the filters (the Planner's Past tab): events
 * that have started by `cutoff`, as in the history, cancelled ones included.
 * Newest first, one row more than `limit`.
 */
export const pastEventsWindow = (
  groupId: string,
  filters: EntryFilters,
  limit: number,
  cutoff: string,
): LocalQuery => {
  const from = pastEventsFrom(groupId, filters, cutoff);
  return {
    sql: `${from.sql} ORDER BY occurred_at DESC, id DESC LIMIT ?`,
    params: [...from.params, limit + 1],
  };
};

/** `pastEventsWindow`'s rows, unordered and uncapped (the Past tab's text filter reads them all). */
export const pastEventsFrom = (groupId: string, filters: EntryFilters, cutoff: string): LocalQuery => {
  const { conditions, params } = filterConditions(groupId, filters, ["event"]);
  conditions.push("occurred_at <= ?");
  params.push(toLocalTimestamp(cutoff));
  return { sql: `FROM timeline_entry WHERE ${conditions.join(" AND ")}`, params };
};

/** One group's entries under the filters, newest first (`entryWindow`). */
export const entriesQuery = (groupId: string, filters: EntryFilters, limit: number): LocalQuery => {
  const window = entryWindow(groupId, filters, limit);
  return { sql: `SELECT * ${window.sql}`, params: window.params };
};

/** The timeline's history: one group's entries under the filters, newest first, ending at `cutoff` (`historyWindow`). */
export const historyQuery = (
  groupId: string,
  filters: EntryFilters,
  limit: number,
  cutoff: string,
  before?: string | null,
): LocalQuery => {
  const window = historyWindow(groupId, filters, limit, cutoff, before);
  return { sql: `SELECT * ${window.sql}`, params: window.params };
};

/** Upcoming notes and events under the filters, soonest first (`upcomingWindow`): the Next strip and the Upcoming block. */
export const upcomingQuery = (groupId: string, filters: EntryFilters, now: Date): LocalQuery => {
  const window = upcomingWindow(groupId, filters, now);
  return { sql: `SELECT * ${window.sql}`, params: window.params };
};

export type GroupRow = {
  id: string;
  name: string | null;
  role: string | null;
  recipient_id: string | null;
  recipient_name: string | null;
  recipient_preferred_name: string | null;
  recipient_time_zone: string | null;
};

/** The groups `userId` belongs to, with their role and the recipient. */
export const myGroupsQuery = (userId: string): LocalQuery => ({
  sql: `SELECT g.id, g.name, m.role, r.id AS recipient_id, r.name AS recipient_name,
               r.preferred_name AS recipient_preferred_name, r.time_zone AS recipient_time_zone
        FROM care_group g
        JOIN care_group_member m ON m.group_id = g.id AND m.user_id = ?
        LEFT JOIN care_recipient r ON r.group_id = g.id
        ORDER BY g.name, g.id`,
  params: [userId],
});

/** One group `userId` belongs to (no row when they aren't a member, or it isn't on the device). */
export const myGroupQuery = (userId: string, groupId: string): LocalQuery => ({
  sql: `SELECT g.id, g.name, m.role, r.id AS recipient_id, r.name AS recipient_name,
               r.preferred_name AS recipient_preferred_name, r.time_zone AS recipient_time_zone
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

/**
 * The group's newest vital reading of each type, newest first (`toLatestVitals`
 * reads them): one row per type, never every reading in the group (B-313).
 * A reading's type is the same in every row it ranks against, so which types
 * `toLatestVitals` keeps doesn't change.
 */
export const readingsQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT entry_id, occurred_at, reading FROM (
          SELECT e.id AS entry_id, e.occurred_at, r.value AS reading,
                 ROW_NUMBER() OVER (
                   PARTITION BY json_extract(r.value, '$.type') ORDER BY e.occurred_at DESC, e.id DESC
                 ) AS newest
          FROM timeline_entry e, json_each(e.details, '$.readings') r
          WHERE e.group_id = ? AND e.kind = 'vital' AND e.deleted_at IS NULL
        )
        WHERE newest = 1
        ORDER BY occurred_at DESC, entry_id DESC`,
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

/** Whether this device's user may log in the group (writers, and an Easy helper). */
export const mayLog = async (db: SyncDb, groupId: string) =>
  isLoggerRole((await groupFor(db, groupId))?.role);

/** Whether this device's user may edit or delete the entry: writers any, an Easy helper their own. */
export const mayChangeEntry = async (db: SyncDb, entry: { groupId: string; createdBy: string | null }) =>
  canChangeEntry({ role: (await groupFor(db, entry.groupId))?.role, userId: db.userId, entry });

export const contentColumns = (content: Omit<TimelineEntryContent, "kind">) => ({
  occurredAt: toLocalTimestamp(content.occurredAt),
  timeZone: content.timeZone,
  title: content.title ?? null,
  body: content.body ?? null,
  details: content.details ? JSON.stringify(content.details) : null,
  endsAt: content.endsAt ? toLocalTimestamp(content.endsAt) : null,
  allDay: content.allDay ? 1 : 0,
  place: content.place ?? null,
  cancelledAt: content.cancelledAt ? toLocalTimestamp(content.cancelledAt) : null,
  cancelReason: content.cancelReason ?? null,
  rescheduledTo: content.rescheduledTo ?? null,
  seriesId: content.seriesId ?? null,
  seriesDay: content.seriesDay ?? null,
  seriesDetached: content.seriesDetached ? 1 : 0,
});

/**
 * A symptom's catalog row: `symptom`, the row `addSymptomTypeIn` resolved,
 * when given; else derived from its name as the server derives it
 * (`symptomTypeId`), so the local copy points where the server's will. Null
 * for every other kind. The server ignores the device's value (serverSet).
 */
export const symptomTypeColumn = (
  groupId: string,
  content: { kind: string; details?: TimelineEntryContent["details"] },
  symptom?: { id: string } | null,
) => ({
  symptomTypeId:
    content.kind === "symptom" && isSymptomDetails(content.details)
      ? (symptom?.id ?? symptomTypeId(groupId, content.details.name))
      : null,
});

/**
 * A symptom's content with the name `addSymptomTypeIn` resolved it to (a
 * deleted name's replacement, symptom-catalog-3), as the server stores it;
 * any other content, or no `symptom`, as it is.
 */
export const withSymptomName = <C extends { kind: string; details?: TimelineEntryContent["details"] }>(
  content: C,
  symptom: { name: string } | null,
): C =>
  symptom &&
  content.kind === "symptom" &&
  isSymptomDetails(content.details) &&
  content.details.name !== symptom.name
    ? { ...content, details: { ...content.details, name: symptom.name } }
    : content;

/** The refusal when an entry of this kind is dated past now plus the device's skew (5 minutes). */
export const futureRefusal = (kind: string, occurredAt: string, now = new Date()): ActionResult | null =>
  isTooFarAhead(kind, occurredAt, now, DEVICE_FUTURE_SKEW_MS)
    ? invalid({ issues: [{ path: ["occurredAt"], message: FUTURE_DATE_MESSAGE }] })
    : null;

/** Add an entry on this device. It syncs when the device is online. */
export const createEntry = async (db: SyncDb, groupId: string, input: unknown): Promise<ActionResult> => {
  const group = await groupFor(db, groupId);
  if (!isLoggerRole(group?.role)) return forbidden;
  if (!group?.recipient) return { ok: false, error: "This care group has no care recipient yet", issues: [] };

  const parsed = timelineEntryContentZSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  // An Easy helper logs notes, events, symptoms, vitals and doses only.
  if (!canLogEntry(group.role, parsed.data.kind, parsed.data)) return forbidden;
  const future = futureRefusal(parsed.data.kind, parsed.data.occurredAt);
  if (future) return future;

  const now = nowTimestamp();
  const content = parsed.data;
  const recipientId = group.recipient.id;
  // A symptom's name joins the catalog in the same write, when it's new; a
  // deleted name saves as its replacement.
  await db.drizzle.transaction(async (tx) => {
    const symptom =
      content.kind === "symptom" && isSymptomDetails(content.details)
        ? await addSymptomTypeIn(tx, { groupId, name: content.details.name, userId: db.userId, now })
        : null;
    const stored = withSymptomName(content, symptom);
    await tx.insert(timelineEntries).values({
      id: crypto.randomUUID(),
      groupId,
      recipientId,
      kind: content.kind,
      ...contentColumns(stored),
      ...symptomTypeColumn(groupId, stored, symptom),
      cancelledBy: content.cancelledAt ? db.userId : null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: db.userId,
      updatedBy: db.userId,
    });
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
 * With `detach`, a series visit is also marked as changed on its own
 * ("Only this visit": later series edits leave it as it is).
 */
export const updateEntry = async (
  db: SyncDb,
  id: string,
  patch: TimelineEntryUpdateInput,
  { detach = false }: { detach?: boolean } = {},
): Promise<ActionResult> => {
  const entry = await existingEntry(db, id);
  if (!entry) return missing;
  const group = await groupFor(db, entry.groupId);
  // Writers change any entry; an Easy helper only one they made.
  if (!canChangeEntry({ role: group?.role, userId: db.userId, entry })) return forbidden;
  // Nor may an Easy helper set, or clear, an appointment's setup.
  if (!canLogEntry(group?.role, entry.kind, patch, entry)) return forbidden;

  const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  if (detach && entry.seriesId) defined.seriesDetached = true;
  const stored = {
    kind: entry.kind,
    title: entry.title,
    body: entry.body,
    occurredAt: entry.occurredAt,
    timeZone: entry.timeZone,
    details: entry.details,
    allDay: entry.allDay,
    endsAt: entry.endsAt,
    place: entry.place,
    cancelledAt: entry.cancelledAt,
    cancelReason: entry.cancelReason,
    rescheduledTo: entry.rescheduledTo,
    seriesId: entry.seriesId,
    seriesDay: entry.seriesDay,
    seriesDetached: entry.seriesDetached,
  };
  const merged = timelineEntryContentZSchema.safeParse({ ...stored, ...defined });
  if (!merged.success) return invalid(merged.error);
  if (new Date(merged.data.occurredAt).getTime() !== new Date(entry.occurredAt).getTime()) {
    const future = futureRefusal(entry.kind, merged.data.occurredAt);
    if (future) return future;
  }
  // Who cancelled is shown at once here; the server sets its own copy.
  const cancelledBy = merged.data.cancelledAt ? (entry.cancelledAt ? entry.cancelledBy : db.userId) : null;

  // Only what changed: the details rewritten unchanged would be re-sent and
  // overwrite a co-member's newer ones on the server.
  const changedTo = (content: typeof merged.data, symptom: { id: string } | null = null) =>
    changedColumns(
      { ...contentColumns(stored), cancelledBy: entry.cancelledBy, symptomTypeId: entry.symptomTypeId },
      { ...contentColumns(content), cancelledBy, ...symptomTypeColumn(entry.groupId, content, symptom) },
      ["details"],
    );
  const changed = changedTo(merged.data);
  if (!Object.keys(changed).length) return { ok: true };
  const now = nowTimestamp();
  // A symptom renamed to a new name adds it to the catalog in the same
  // write; to a deleted one, it saves as the replacement (maybe no change).
  await db.drizzle.transaction(async (tx) => {
    const symptom =
      changed.symptomTypeId && isSymptomDetails(merged.data.details)
        ? await addSymptomTypeIn(tx, {
            groupId: entry.groupId,
            name: merged.data.details.name,
            userId: db.userId,
            now,
          })
        : null;
    const write = symptom ? changedTo(withSymptomName(merged.data, symptom), symptom) : changed;
    if (!Object.keys(write).length) return;
    await tx
      .update(timelineEntries)
      .set({ ...write, updatedAt: now, updatedBy: db.userId })
      .where(eq(timelineEntries.id, id));
  });
  return { ok: true };
};

/**
 * Soft delete, so the deletion syncs to everyone's devices. Deleting an
 * event that others were rescheduled to leaves them cancelled, with no
 * link (in the same local transaction). Its todos keep their link rows,
 * which readers skip while the entry is deleted.
 */
export const removeEntry = async (db: SyncDb, id: string): Promise<ActionResult> => {
  const entry = await existingEntry(db, id);
  if (!entry) return { ok: true };
  const group = await groupFor(db, entry.groupId);
  if (!canChangeEntry({ role: group?.role, userId: db.userId, entry })) return forbidden;

  const now = nowTimestamp();
  await db.drizzle.transaction(async (tx) => {
    await tx
      .update(timelineEntries)
      .set({ deletedAt: now, updatedAt: now, updatedBy: db.userId })
      .where(eq(timelineEntries.id, id));
    if (entry.kind === "event") {
      await tx
        .update(timelineEntries)
        .set({ rescheduledTo: null, updatedAt: now, updatedBy: db.userId })
        .where(
          and(
            eq(timelineEntries.groupId, entry.groupId),
            eq(timelineEntries.rescheduledTo, id),
            isNull(timelineEntries.deletedAt),
          ),
        );
      // Its todos stay, and so do their link rows (planner-3): readers join
      // live entries, so the link just stops showing. The server clears an
      // old client's `event_id` (`releaseEvent`).
    }
  });
  return { ok: true };
};
