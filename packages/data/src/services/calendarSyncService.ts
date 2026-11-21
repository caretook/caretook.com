import type { Tx } from "../db";
import type {
  CalendarEntryInput,
  CalendarItem,
  CalendarSyncJob,
  CalendarSyncReason,
  GoogleCalendarConnection,
  GoogleConnectionError,
  ShareLevel,
} from "../db/schema";
import type { AppError } from "../errors";
import type { GoogleCalendarClient } from "../google";

import { and, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { SYSTEM_USER } from "../constants";
import { afterCommit, dbMayFail, getDb, txOrDb } from "../db";
import {
  calendarItems,
  calendarSyncJobSchema as job,
  calendarWindow,
  careGroupSchema,
  careRecipientSchema,
  googleCalendarConnectionSchema as connection,
  googleEventLinkSchema as link,
  memberCalendarSettingSchema,
  providerSchema,
  shareLevel,
  todoSchema,
  timelineEntryProviderSchema,
  timelineEntrySchema,
} from "../db/schema";
import { isError, newError } from "../errors";
import { appOrigin, getGoogleCalendarClient, inCalendarBackground, planPush } from "../google";
import { logError } from "../logging";
import { openGoogleToken } from "../utils/googleToken";

export const serviceName = "calendarSync";

// Pushing Caretook's calendar to members' Google calendars (appointments-2,
// slice 7). A write that can change a calendar item (an appointment or
// reminder, a todo, a series, a member's consent) queues a job in its own
// transaction (`enqueue`), only when the group has a live connection. Once
// that commits, the job runs in the background (`waitUntil` on Vercel), and
// the calendar cron's `googlePush` step sweeps whatever is left, with the
// outbox's claim (`FOR UPDATE SKIP LOCKED`) and backoff. A run diffs each
// connection's items, at its share level, against what it last pushed, by
// hash: it writes what changed, deletes what left the window or was
// deleted, and records a refused token ("Reconnect Google"). The system's
// work: these tables have no model.

/** A job is dropped (and logged) after this many failed runs. */
export const MAX_SYNC_ATTEMPTS = 8;
/** One sweep claims at most this many jobs. */
export const SYNC_BATCH_LIMIT = 20;
/** A job left claimed this long (a crashed run) is claimed again. */
export const STALE_SYNC_CLAIM_MINUTES = 10;
/** Every live connection is pushed at least this often, so items leave the window on time. */
export const DAILY_PUSH_HOURS = 24;

const BACKOFF_BASE_MS = 60_000;
const BACKOFF_MAX_MS = 6 * 60 * 60_000;

/** Wait before the next try after `attempts` failed ones: 1, 2, 4 … minutes, at most 6 h (the outbox's). */
export const syncRetryDelayMs = (attempts: number) =>
  Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_MAX_MS);

const SYSTEM = SYSTEM_USER.id;
const dbFails = <T>(run: () => PromiseLike<T>) => dbMayFail(run, "calendarSyncService:db");

// ---------------------------------------------------------------------------
// Queueing
// ---------------------------------------------------------------------------

export type SyncTarget =
  | { groupId: string }
  | { connectionId: string }
  | { entryId: string }
  | { todoId: string }
  /** One member's connection in a group (their consent changed). */
  | { memberId: string; inGroup: string };

const liveConnectionIn = (groupId: unknown) =>
  sql`EXISTS (SELECT 1 FROM ${connection} WHERE ${connection.groupId} = ${groupId} AND ${connection.disconnectedAt} IS NULL)`;

/** The statement that queues a job for `target`, if its group has a live connection. */
const enqueueStatement = (target: SyncTarget, reason: CalendarSyncReason) => {
  const audit = sql`${reason}, ${SYSTEM}::uuid, ${SYSTEM}::uuid`;
  const insert = (column: "group_id" | "connection_id") =>
    sql`INSERT INTO ${job} (${sql.raw(column)}, reason, created_by, updated_by)`;
  if ("connectionId" in target)
    return sql`${insert("connection_id")} SELECT ${connection.id}, ${audit} FROM ${connection}
      WHERE ${connection.id} = ${target.connectionId} AND ${connection.disconnectedAt} IS NULL
      ON CONFLICT DO NOTHING`;
  if ("memberId" in target)
    return sql`${insert("connection_id")} SELECT ${connection.id}, ${audit} FROM ${connection}
      WHERE ${connection.userId} = ${target.memberId} AND ${connection.groupId} = ${target.inGroup}
      AND ${connection.disconnectedAt} IS NULL ON CONFLICT DO NOTHING`;
  if ("groupId" in target)
    return sql`${insert("group_id")} SELECT ${target.groupId}::uuid, ${audit}
      WHERE ${liveConnectionIn(sql`${target.groupId}::uuid`)} ON CONFLICT DO NOTHING`;
  if ("entryId" in target)
    // Only appointments and notes (reminders) reach a calendar.
    return sql`${insert("group_id")} SELECT ${timelineEntrySchema.groupId}, ${audit} FROM ${timelineEntrySchema}
      WHERE ${timelineEntrySchema.id} = ${target.entryId} AND ${timelineEntrySchema.kind} IN ('event', 'note')
      AND ${liveConnectionIn(timelineEntrySchema.groupId)} ON CONFLICT DO NOTHING`;
  return sql`${insert("group_id")} SELECT ${todoSchema.groupId}, ${audit} FROM ${todoSchema}
    WHERE ${todoSchema.id} = ${target.todoId} AND ${liveConnectionIn(todoSchema.groupId)} ON CONFLICT DO NOTHING`;
};

/**
 * Queue a push for `target` in the caller's transaction (only when its
 * group has a live Google connection; one waiting job per group or
 * connection), and start it once that commits. Returns an AppError only
 * when the write fails, which fails the caller's transaction with it.
 */
export const enqueue = async (tx: Tx | undefined, target: SyncTarget, reason: CalendarSyncReason) => {
  const done = await dbFails(() => txOrDb(tx).execute(enqueueStatement(target, reason)));
  if (isError(done)) return done;
  if ((done.rowCount ?? 0) > 0) afterCommit(tx, runSoon);
  return null;
};

/** Run what's due in the background, when Google is set up here. */
export const runSoon = () => {
  if (!getGoogleCalendarClient()) return;
  inCalendarBackground(() => runDue({ limit: 5 }));
};

// ---------------------------------------------------------------------------
// One connection's push
// ---------------------------------------------------------------------------

export type PushResult =
  | { status: "pushed"; upserted: number; deleted: number; unchanged: number }
  | { status: "stopped"; error: GoogleConnectionError };

/** Record why a connection stopped syncing (the card says "Reconnect Google"). */
const recordStop = async (conn: GoogleCalendarConnection, error: GoogleConnectionError, now: Date) => {
  const done = await dbFails(() =>
    getDb()
      .update(connection)
      .set({ lastError: error, lastErrorAt: now.toISOString(), updatedBy: SYSTEM })
      .where(eq(connection.id, conn.id)),
  );
  return isError(done) ? done : ({ status: "stopped", error } as const);
};

/** The member's share level in the connection's group: details only with their consent and the owners'. */
const levelOf = async (conn: GoogleCalendarConnection): Promise<ShareLevel | AppError> => {
  const rows = await dbFails(() =>
    getDb()
      .select({
        allowed: careGroupSchema.detailsOutsideAllowed,
        consentAt: memberCalendarSettingSchema.detailsConsentAt,
      })
      .from(careGroupSchema)
      .leftJoin(
        memberCalendarSettingSchema,
        and(
          eq(memberCalendarSettingSchema.groupId, careGroupSchema.id),
          eq(memberCalendarSettingSchema.userId, conn.userId),
        ),
      )
      .where(eq(careGroupSchema.id, conn.groupId)),
  );
  if (isError(rows)) return rows;
  const row = rows[0];
  return shareLevel({ memberConsent: !!row?.consentAt, groupAllowsDetails: !!row?.allowed });
};

/** A group's calendar items around `now` (the 90-day window each way). */
export const groupItems = async (groupId: string, now: Date): Promise<CalendarItem[] | AppError> => {
  const { from, to } = calendarWindow(now);
  const db = getDb();
  // A little wider than the window: an item overlapping its edge counts, and calendarItems decides.
  const after = new Date(from.getTime() - 2 * 86_400_000).toISOString();
  const before = new Date(to.getTime() + 86_400_000).toISOString();
  const loaded = await dbFails(async () => {
    const [recipient] = await db
      .select({
        name: careRecipientSchema.name,
        preferredName: careRecipientSchema.preferredName,
        timeZone: careRecipientSchema.timeZone,
      })
      .from(careRecipientSchema)
      .where(eq(careRecipientSchema.groupId, groupId));
    const entries = await db
      .select()
      .from(timelineEntrySchema)
      .where(
        and(
          eq(timelineEntrySchema.groupId, groupId),
          inArray(timelineEntrySchema.kind, ["event", "note"]),
          isNull(timelineEntrySchema.deletedAt),
          gte(timelineEntrySchema.occurredAt, after),
          lt(timelineEntrySchema.occurredAt, before),
        ),
      );
    const ids = entries.map((e) => e.id);
    const providers = ids.length
      ? await db
          .select({ entryId: timelineEntryProviderSchema.entryId, name: providerSchema.name })
          .from(timelineEntryProviderSchema)
          .innerJoin(providerSchema, eq(providerSchema.id, timelineEntryProviderSchema.providerId))
          .where(inArray(timelineEntryProviderSchema.entryId, ids))
          .orderBy(providerSchema.name)
      : [];
    const todos = await db
      .select()
      .from(todoSchema)
      .where(
        and(
          eq(todoSchema.groupId, groupId),
          isNull(todoSchema.deletedAt),
          isNull(todoSchema.doneAt),
          isNotNull(todoSchema.dueOn),
        ),
      );
    return { recipient, entries, providers, todos };
  });
  if (isError(loaded)) return loaded;
  const { recipient, entries, providers, todos } = loaded;
  if (!recipient) return [];
  const names = new Map<string, string[]>();
  for (const p of providers) names.set(p.entryId, [...(names.get(p.entryId) ?? []), p.name]);
  return calendarItems({
    entries: entries.map((e): CalendarEntryInput => ({ ...e, providers: names.get(e.id) ?? [] })),
    todos,
    recipient: {
      displayName: recipient.preferredName?.trim() || recipient.name,
      timeZone: recipient.timeZone,
    },
    from,
    to,
    appUrl: appOrigin(),
  });
};

/**
 * Bring one connection's Google calendar up to date. A refused token or a
 * missing calendar stops the connection (recorded, not retried); any other
 * failure is returned, and the job retries (what was already written stays
 * written, so the retry diffs to the rest).
 */
export const pushConnection = async (
  conn: GoogleCalendarConnection,
  { client, now = new Date() }: { client: GoogleCalendarClient; now?: Date },
): Promise<PushResult | AppError> => {
  const token = conn.refreshTokenSealed ? openGoogleToken(conn.refreshTokenSealed, conn.id) : null;
  if (!token) return recordStop(conn, "revoked", now);
  const session = await client.refresh(token);
  if (isError(session))
    return session.code === "googleCalendar:revoked" ? recordStop(conn, "revoked", now) : session;

  const level = await levelOf(conn);
  if (isError(level)) return level;
  const items = await groupItems(conn.groupId, now);
  if (isError(items)) return items;
  const links = await dbFails(() => getDb().select().from(link).where(eq(link.connectionId, conn.id)));
  if (isError(links)) return links;

  const plan = planPush({ items, links, level });
  const stopFor = (error: AppError) =>
    error.code === "googleCalendar:revoked"
      ? recordStop(conn, "revoked", now)
      : error.code === "googleCalendar:notFound"
        ? recordStop(conn, "calendarGone", now)
        : error;

  for (const { uid, event, hash } of plan.upserts) {
    const written = await session.upsertEvent(conn.calendarId, event);
    if (isError(written)) return stopFor(written);
    const saved = await dbFails(() =>
      getDb()
        .insert(link)
        .values({
          connectionId: conn.id,
          itemUid: uid,
          googleEventId: written.id,
          etag: written.etag,
          pushedHash: hash,
          createdBy: SYSTEM,
          updatedBy: SYSTEM,
        })
        .onConflictDoUpdate({
          target: [link.connectionId, link.itemUid],
          set: { googleEventId: written.id, etag: written.etag, pushedHash: hash, updatedBy: SYSTEM },
        }),
    );
    if (isError(saved)) return saved;
  }
  for (const gone of plan.deletes) {
    const deleted = await session.deleteEvent(conn.calendarId, gone.googleEventId);
    if (isError(deleted)) return stopFor(deleted);
    const removed = await dbFails(() =>
      getDb()
        .delete(link)
        .where(and(eq(link.connectionId, conn.id), eq(link.itemUid, gone.itemUid))),
    );
    if (isError(removed)) return removed;
  }
  const marked = await dbFails(() =>
    getDb()
      .update(connection)
      .set({ lastPushedAt: now.toISOString(), lastError: null, lastErrorAt: null, updatedBy: SYSTEM })
      .where(eq(connection.id, conn.id)),
  );
  if (isError(marked)) return marked;
  return {
    status: "pushed",
    upserted: plan.upserts.length,
    deleted: plan.deletes.length,
    unchanged: plan.unchanged,
  };
};

// ---------------------------------------------------------------------------
// Running jobs
// ---------------------------------------------------------------------------

export type SyncRunSummary = {
  claimed: number;
  /** Connections brought up to date. */
  pushed: number;
  /** Connections stopped (a refused token, a missing calendar). */
  stopped: number;
  /** Jobs to try again later. */
  retried: number;
  /** Jobs dropped after MAX_SYNC_ATTEMPTS. */
  failed: number;
};

/** Claim due jobs (waiting and due, or stuck claimed) so concurrent runs never take the same one. */
const claim = (limit: number) => {
  const db = getDb();
  const due = sql`(${job.claimedAt} IS NULL AND ${job.nextAttemptAt} <= now())
    OR ${job.claimedAt} < now() - make_interval(mins => ${STALE_SYNC_CLAIM_MINUTES})`;
  const candidates = db
    .select({ id: job.id })
    .from(job)
    .where(due)
    .orderBy(job.nextAttemptAt)
    .limit(limit)
    .for("update", { skipLocked: true });
  return db
    .update(job)
    .set({ claimedAt: sql`now()`, attempts: sql`${job.attempts} + 1`, updatedBy: SYSTEM })
    .where(inArray(job.id, candidates))
    .returning();
};

/** The live, syncing connections a job covers. */
const connectionsFor = (claimed: CalendarSyncJob) =>
  dbFails(() =>
    getDb()
      .select()
      .from(connection)
      .where(
        and(
          claimed.connectionId
            ? eq(connection.id, claimed.connectionId)
            : eq(connection.groupId, claimed.groupId ?? ""),
          isNull(connection.disconnectedAt),
          isNull(connection.lastError),
        ),
      ),
  );

/** A failed job goes back in line with backoff, unless a newer one for the same target is already waiting. */
const retryLater = (claimed: CalendarSyncJob, error: string) =>
  dbFails(async () => {
    const db = getDb();
    await db.delete(job).where(eq(job.id, claimed.id));
    if (claimed.attempts >= MAX_SYNC_ATTEMPTS) return "failed" as const;
    await db
      .insert(job)
      .values({
        groupId: claimed.groupId,
        connectionId: claimed.connectionId,
        reason: claimed.reason,
        attempts: claimed.attempts,
        nextAttemptAt: sql`now() + make_interval(secs => ${syncRetryDelayMs(claimed.attempts) / 1000})`,
        lastError: error.slice(0, 200),
        createdBy: SYSTEM,
        updatedBy: SYSTEM,
      })
      .onConflictDoNothing();
    return "retried" as const;
  });

/**
 * Run the due jobs: push every connection each covers, then drop the job;
 * a failure retries it with backoff. Without a configured Google client it
 * does nothing (and leaves the jobs).
 */
export const runDue = async ({
  limit = SYNC_BATCH_LIMIT,
  client = getGoogleCalendarClient(),
  now = new Date(),
}: { limit?: number; client?: GoogleCalendarClient | null; now?: Date } = {}): Promise<
  SyncRunSummary | AppError
> => {
  const summary: SyncRunSummary = { claimed: 0, pushed: 0, stopped: 0, retried: 0, failed: 0 };
  if (!client) return summary;
  const claimed = await dbFails(() => claim(Math.min(limit, SYNC_BATCH_LIMIT)));
  if (isError(claimed)) return claimed;
  summary.claimed = claimed.length;

  for (const claimedJob of claimed) {
    const connections = await connectionsFor(claimedJob);
    let failure: string | null = isError(connections) ? String(connections.code) : null;
    if (!isError(connections)) {
      for (const conn of connections) {
        const result = await pushConnection(conn, { client, now });
        if (isError(result)) {
          logError("calendars: Google push failed", result, { groupId: conn.groupId, recordId: conn.id });
          failure = String(result.code);
        } else if (result.status === "stopped") summary.stopped++;
        else summary.pushed++;
      }
    }
    if (!failure) {
      const dropped = await dbFails(() => getDb().delete(job).where(eq(job.id, claimedJob.id)));
      if (isError(dropped))
        logError("calendars: couldn't finish a sync job", dropped, { recordId: claimedJob.id });
      continue;
    }
    const outcome = await retryLater(claimedJob, failure);
    if (isError(outcome))
      logError("calendars: couldn't requeue a sync job", outcome, { recordId: claimedJob.id });
    else if (outcome === "failed") {
      summary.failed++;
      logError("calendars: a sync job failed for good", newError({ code: "googleCalendar:failed" }), {
        recordId: claimedJob.id,
        attempts: claimedJob.attempts,
      });
    } else summary.retried++;
  }
  return summary;
};

/**
 * The calendar cron's `googlePush` step: queue the daily push for
 * connections not pushed in 24 h (so items leave the window on time), then
 * run what's due.
 */
export const sweep = async ({
  now = new Date(),
  client = getGoogleCalendarClient(),
}: { now?: Date; client?: GoogleCalendarClient | null } = {}) => {
  if (!client) return { configured: false };
  const daily = await dbFails(() =>
    getDb().execute(sql`INSERT INTO ${job} (connection_id, reason, created_by, updated_by)
      SELECT ${connection.id}, 'daily', ${SYSTEM}::uuid, ${SYSTEM}::uuid FROM ${connection}
      WHERE ${connection.disconnectedAt} IS NULL AND ${connection.lastError} IS NULL
        AND (${connection.lastPushedAt} IS NULL OR ${connection.lastPushedAt} < ${new Date(now.getTime() - DAILY_PUSH_HOURS * 3_600_000).toISOString()})
      ORDER BY ${connection.lastPushedAt} NULLS FIRST LIMIT ${SYNC_BATCH_LIMIT}
      ON CONFLICT DO NOTHING`),
  );
  if (isError(daily)) return daily;
  const ran = await runDue({ client, now });
  if (isError(ran)) return ran;
  return { configured: true, queuedDaily: daily.rowCount ?? 0, ...ran };
};
