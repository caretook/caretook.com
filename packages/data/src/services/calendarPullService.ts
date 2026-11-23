import type { GroupRoleName } from "../constants/roles";
import type { Tx } from "../db";
import type {
  CalendarItem,
  GoogleCalendarConnection,
  GoogleConnectionError,
  GoogleEventLink,
} from "../db/schema";
import type { AppError } from "../errors";
import type { GoogleCalendarClient, GoogleCalendarSession, GoogleChangeAction, GoogleEvent } from "../google";
import type { ServiceContext } from "./types";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { SYSTEM_USER } from "../constants";
import { dbMayFail, getDb, txOrDb, withTransaction } from "../db";
import {
  careRecipientSchema,
  googleCalendarConnectionSchema as connection,
  googleEventLinkSchema as link,
  googleWindow,
} from "../db/schema";
import { ERRORS } from "../errors/constants";
import { isError } from "../errors";
import { eventUid, getGoogleCalendarClient, interpretGoogleChange } from "../google";
import { logError } from "../logging";
import { careGroupMemberModel, userModel } from "../models";
import { openGoogleToken } from "../utils/googleToken";
import * as calendarSyncService from "./calendarSyncService";
import * as noteDocumentService from "./noteDocumentService";
import * as todoService from "./todoService";
import * as timelineEntryService from "./timelineEntryService";

export const serviceName = "calendarPull";

// Pulling members' changes back from Google Calendar (appointments-2, slice
// 9). The calendar cron's `googlePull` step (`pullDue`) takes each live
// connection at most every 5 minutes, lists what changed in its calendar
// since the stored sync token (all of it when there is none, or when Google
// asks for a full sync), and turns each change into one action
// (`interpretGoogleChange`, pure). Actions are applied through the services
// as the connecting member, so RBAC is the usual SQL and the audits name
// them. What their role can't do, or a service refuses, is overwritten: the
// event's pushed hash is cleared and the connection queued, so the next push
// puts Caretook's version back. A passing failure (the database, Google)
// leaves the sync token as it was, so the next pull sees the same changes.
//
// Once a day a pull also catches up (calendars-2): it lists the Google horizon
// and runs the same planner over events with no link and none of our uid, so
// one that was too far off when the change list showed it still arrives. The
// change list owns linked events, and the catch-up never touches the sync token.

/** A connection is pulled at most this often. */
export const PULL_EVERY_MINUTES = 5;
/** One sweep pulls at most this many connections. */
export const PULL_BATCH_LIMIT = 20;
/** A connection catches up at most this often. */
export const CATCH_UP_EVERY_HOURS = 24;
/** A cancelled appointment's reason when it was deleted in Google. */
export const DELETED_IN_GOOGLE_REASON = "Deleted in Google Calendar";

const SYSTEM = SYSTEM_USER.id;
const dbFails = <T>(run: () => PromiseLike<T>) => dbMayFail(run, "calendarSyncService:db");

/** A refusal (a 4xx: a role, a rule, a row that's gone) is overwritten; anything else is a passing failure. */
const isRefusal = (error: AppError) => {
  const status = (ERRORS[error.code] as { statusCode?: number } | undefined)?.statusCode;
  return status !== undefined && status >= 400 && status < 500;
};

export type PullResult =
  | {
      status: "pulled";
      changes: number;
      applied: number;
      overwritten: number;
      ignored: number;
      /** Google asked for a full sync (or there was no token yet), so the whole calendar was listed. */
      fullSync: boolean;
    }
  | { status: "stopped"; error: GoogleConnectionError }
  /** The member has left the group or their account is disabled: nothing is applied. */
  | { status: "skipped" };

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

/** The connecting member as the services see them: their role in this group only. */
const memberContext = async (conn: GoogleCalendarConnection) => {
  const role = await careGroupMemberModel.getRole(conn.groupId, conn.userId);
  if (isError(role) || !role) return role;
  const user = await userModel.getWholeById(conn.userId, { authUser: SYSTEM_USER });
  if (isError(user)) return user;
  if (!user || user.disabledAt) return null;
  const ctx: ServiceContext = {
    authUser: { id: conn.userId, roleNames: ["member"], groupRoles: { [conn.groupId]: role } },
  };
  return { ctx, role };
};

/** Make the next push write this event again (or, with no item behind it, delete it). */
const overwrite = (conn: GoogleCalendarConnection, existing: GoogleEventLink | null, change: GoogleEvent) =>
  dbFails(() =>
    existing
      ? getDb().update(link).set({ pushedHash: "", updatedBy: SYSTEM }).where(eq(link.id, existing.id))
      : // A viewer's new event: a link to no item, which the push deletes.
        getDb()
          .insert(link)
          .values({
            connectionId: conn.id,
            itemUid: `google:${change.id}`,
            googleEventId: change.id,
            etag: change.etag,
            pushedHash: "",
            createdBy: SYSTEM,
            updatedBy: SYSTEM,
          })
          .onConflictDoNothing(),
  );

/** A Google-made event as a new appointment with an empty document, linked to the event in one transaction. */
const createAppointment = (
  ctx: ServiceContext,
  conn: GoogleCalendarConnection,
  action: Extract<GoogleChangeAction, { type: "createAppointment" }>,
  change: GoogleEvent,
) =>
  withTransaction(async (tx: Tx) => {
    const id = randomUUID();
    const inTx = { ...ctx, tx };
    const entry = await timelineEntryService.create(inTx, {
      id,
      groupId: conn.groupId,
      kind: "event",
      title: action.title,
      occurredAt: action.occurredAt,
      timeZone: action.timeZone,
      allDay: action.allDay,
      endsAt: action.endsAt,
      details: null,
    });
    if (isError(entry) || !entry) return entry;
    const document = await noteDocumentService.create(inTx, { id, groupId: conn.groupId });
    if (isError(document)) return document;
    // Google's id stays the event's: the next push tags it with our uid and text.
    const linked = await dbFails(() =>
      txOrDb(tx)
        .insert(link)
        .values({
          connectionId: conn.id,
          itemUid: `entry:${id}`,
          googleEventId: action.googleEventId,
          etag: change.etag,
          pushedHash: "",
          createdBy: SYSTEM,
          updatedBy: SYSTEM,
        }),
    );
    return isError(linked) ? linked : entry;
  }, ctx);

/** Apply one action as the member. Null (nothing written) counts as refused. */
const apply = (
  ctx: ServiceContext,
  conn: GoogleCalendarConnection,
  action: Exclude<GoogleChangeAction, { type: "ignore" | "overwrite" }>,
  change: GoogleEvent,
  now: Date,
): Promise<unknown> => {
  switch (action.type) {
    case "updateEntry":
      return timelineEntryService.update(ctx, action.entryId, action.patch, { now });
    case "cancelEntry":
      return timelineEntryService.update(
        ctx,
        action.entryId,
        {
          cancelledAt: now.toISOString(),
          cancelReason: DELETED_IN_GOOGLE_REASON,
          ...(action.seriesDetached && { seriesDetached: true }),
        },
        { now },
      );
    case "updateTodo":
      return todoService.update(ctx, action.todoId, { dueOn: action.dueOn, dueTime: action.dueTime });
    case "createAppointment":
      return createAppointment(ctx, conn, action, change);
  }
};

/** Apply a planned change, or mark it to be overwritten when the role or a service refuses it. */
const takeChange = async (
  ctx: ServiceContext,
  conn: GoogleCalendarConnection,
  action: Exclude<GoogleChangeAction, { type: "ignore" }>,
  found: GoogleEventLink | null,
  change: GoogleEvent,
  now: Date,
): Promise<"applied" | "overwritten" | AppError> => {
  if (action.type !== "overwrite") {
    const done = await apply(ctx, conn, action, change, now);
    if (done && !isError(done)) return "applied";
    if (isError(done) && !isRefusal(done)) return done;
  }
  const marked = await overwrite(conn, found, change);
  return isError(marked) ? marked : "overwritten";
};

const catchUpDue = (conn: GoogleCalendarConnection, now: Date) =>
  !conn.lastCatchUpAt ||
  now.getTime() - new Date(conn.lastCatchUpAt).getTime() >= CATCH_UP_EVERY_HOURS * 3_600_000;

/**
 * List the Google horizon and take the events Caretook doesn't know yet,
 * adding what it did to `counts`. The time is recorded only when it finishes;
 * a failure is returned, and the next pull runs it again (what it took is
 * linked by then, so nothing is taken twice).
 */
const catchUp = async (
  session: GoogleCalendarSession,
  conn: GoogleCalendarConnection,
  { ctx, role, timeZone }: { ctx: ServiceContext; role: GroupRoleName; timeZone: string },
  counts: { applied: number; overwritten: number },
  now: Date,
): Promise<AppError | null> => {
  const { from, to } = googleWindow(now);
  const listed = await session.listWindow(conn.calendarId, from, to);
  if (isError(listed)) return listed;
  // Read after the change list ran, so what it just took counts as linked.
  const links = await dbFails(() =>
    getDb().select({ googleEventId: link.googleEventId }).from(link).where(eq(link.connectionId, conn.id)),
  );
  if (isError(links)) return links;
  const known = new Set(links.map((l) => l.googleEventId));

  let failure: AppError | null = null;
  let overwritten = 0;
  for (const change of listed) {
    if (known.has(change.id) || eventUid(change)) continue;
    known.add(change.id);
    const action = interpretGoogleChange({ change, link: null, item: null, role, now, timeZone });
    if (action.type === "ignore") continue;
    const outcome = await takeChange(ctx, conn, action, null, change, now);
    if (isError(outcome)) {
      failure = outcome;
      break;
    }
    if (outcome === "applied") counts.applied++;
    else overwritten++;
  }
  counts.overwritten += overwritten;
  if (overwritten) {
    const queued = await calendarSyncService.enqueue(undefined, { connectionId: conn.id }, "daily");
    if (queued) return queued;
  }
  if (failure) return failure;
  const saved = await dbFails(() =>
    getDb()
      .update(connection)
      .set({ lastCatchUpAt: now.toISOString(), updatedBy: SYSTEM })
      .where(eq(connection.id, conn.id)),
  );
  return isError(saved) ? saved : null;
};

/** The group's items now, by uid, and the recipient's zone. */
const groupState = async (groupId: string, now: Date) => {
  const items = await calendarSyncService.groupItems(groupId, now);
  if (isError(items)) return items;
  const recipients = await dbFails(() =>
    getDb()
      .select({ timeZone: careRecipientSchema.timeZone })
      .from(careRecipientSchema)
      .where(eq(careRecipientSchema.groupId, groupId)),
  );
  if (isError(recipients)) return recipients;
  return {
    items: new Map<string, CalendarItem>(items.map((item) => [item.uid, item])),
    timeZone: recipients[0]?.timeZone ?? "UTC",
  };
};

/**
 * Pull one connection now: list Google's changes since its sync token,
 * apply them as the member, and keep Google's new token. A refused token or
 * a missing calendar stops the connection (recorded); a passing failure is
 * returned and the token kept, so the next pull tries the same changes.
 */
export const pullConnection = async (
  conn: GoogleCalendarConnection,
  { client, now = new Date() }: { client: GoogleCalendarClient; now?: Date },
): Promise<PullResult | AppError> => {
  const member = await memberContext(conn);
  if (isError(member)) return member;
  if (!member) return { status: "skipped" };
  const { ctx, role } = member;

  const token = conn.refreshTokenSealed ? openGoogleToken(conn.refreshTokenSealed, conn.id) : null;
  if (!token) return recordStop(conn, "revoked", now);
  const session = await client.refresh(token);
  if (isError(session))
    return session.code === "googleCalendar:revoked" ? recordStop(conn, "revoked", now) : session;

  const stopFor = (error: AppError) =>
    error.code === "googleCalendar:revoked"
      ? recordStop(conn, "revoked", now)
      : error.code === "googleCalendar:notFound"
        ? recordStop(conn, "calendarGone", now)
        : error;

  let fullSync = !conn.syncToken;
  let listed = await session.listChanges(conn.calendarId, conn.syncToken);
  if (!isError(listed) && listed.fullSyncRequired) {
    fullSync = true;
    listed = await session.listChanges(conn.calendarId, null);
  }
  if (isError(listed)) return stopFor(listed);
  // Google asked for a full sync twice in a row: try again next time.
  if (listed.fullSyncRequired)
    return { status: "pulled", changes: 0, applied: 0, overwritten: 0, ignored: 0, fullSync };

  const state = await groupState(conn.groupId, now);
  if (isError(state)) return state;
  const links = await dbFails(() => getDb().select().from(link).where(eq(link.connectionId, conn.id)));
  if (isError(links)) return links;
  const byEvent = new Map(links.map((l) => [l.googleEventId, l]));
  const byUid = new Map(links.map((l) => [l.itemUid, l]));

  const result = {
    status: "pulled" as const,
    changes: listed.events.length,
    applied: 0,
    overwritten: 0,
    ignored: 0,
    fullSync,
  };
  let failure: AppError | null = null;
  for (const change of listed.events) {
    const uid = eventUid(change);
    const found = byEvent.get(change.id) ?? (uid ? byUid.get(uid) : undefined) ?? null;
    const action = interpretGoogleChange({
      change,
      link: found,
      item: found ? (state.items.get(found.itemUid) ?? null) : null,
      role,
      now,
      timeZone: state.timeZone,
    });
    if (action.type === "ignore") {
      result.ignored++;
      continue;
    }
    const outcome = await takeChange(ctx, conn, action, found, change, now);
    if (isError(outcome)) {
      failure = outcome;
      break;
    }
    result[outcome]++;
  }

  if (result.overwritten) {
    // The next push puts Caretook's version back ("daily": a refresh of this one connection).
    const queued = await calendarSyncService.enqueue(undefined, { connectionId: conn.id }, "daily");
    if (queued) return queued;
  }
  // The token stays as it was: the next pull sees these changes again (what was applied is then unchanged).
  if (failure) return failure;
  const saved = await dbFails(() =>
    getDb()
      .update(connection)
      .set({ syncToken: listed.syncToken || null, lastPulledAt: now.toISOString(), updatedBy: SYSTEM })
      .where(eq(connection.id, conn.id)),
  );
  if (isError(saved)) return saved;
  // Its failure is logged and never fails the pull: the changes and the token are already kept.
  if (catchUpDue(conn, now)) {
    const failed = await catchUp(session, conn, { ctx, role, timeZone: state.timeZone }, result, now);
    if (failed)
      logError("calendars: Google catch-up failed", failed, { groupId: conn.groupId, recordId: conn.id });
  }
  return result;
};

export type PullSweepSummary = {
  configured: boolean;
  /** Connections due and pulled. */
  pulled: number;
  /** Changes applied as members, overwritten, and ignored (echoes, unchanged). */
  applied: number;
  overwritten: number;
  ignored: number;
  /** Connections stopped (a refused token, a missing calendar). */
  stopped: number;
  /** Pulls that failed for now (they run again in 5 minutes). */
  failed: number;
};

/**
 * Claim the connections due a pull (live, syncing, not pulled for 5
 * minutes), marking them pulled now so a concurrent run takes others.
 */
const claimDue = (now: Date, limit: number) => {
  const db = getDb();
  const dueBefore = new Date(now.getTime() - PULL_EVERY_MINUTES * 60_000).toISOString();
  const candidates = db
    .select({ id: connection.id })
    .from(connection)
    .where(
      and(
        isNull(connection.disconnectedAt),
        isNull(connection.lastError),
        or(isNull(connection.lastPulledAt), lte(connection.lastPulledAt, dueBefore)),
      ),
    )
    .orderBy(sql`${connection.lastPulledAt} NULLS FIRST`)
    .limit(limit)
    .for("update", { skipLocked: true });
  return db
    .update(connection)
    .set({ lastPulledAt: now.toISOString(), updatedBy: SYSTEM })
    .where(inArray(connection.id, candidates))
    .returning();
};

/**
 * The calendar cron's `googlePull` step: pull every connection due (at
 * most every 5 minutes each). Without a configured Google client it does
 * nothing. One connection's failure is logged and never stops the others.
 */
export const pullDue = async ({
  now = new Date(),
  client = getGoogleCalendarClient(),
  limit = PULL_BATCH_LIMIT,
}: { now?: Date; client?: GoogleCalendarClient | null; limit?: number } = {}): Promise<
  PullSweepSummary | AppError
> => {
  const summary: PullSweepSummary = {
    configured: !!client,
    pulled: 0,
    applied: 0,
    overwritten: 0,
    ignored: 0,
    stopped: 0,
    failed: 0,
  };
  if (!client) return summary;
  // The claim marks them pulled; each pull reads the row it claimed (sync token included).
  const claimed = await dbFails(() => claimDue(now, Math.min(limit, PULL_BATCH_LIMIT)));
  if (isError(claimed)) return claimed;
  for (const conn of claimed) {
    const result = await pullConnection(conn, { client, now });
    if (isError(result)) {
      logError("calendars: Google pull failed", result, { groupId: conn.groupId, recordId: conn.id });
      summary.failed++;
    } else if (result.status === "stopped") summary.stopped++;
    else if (result.status === "pulled") {
      summary.pulled++;
      summary.applied += result.applied;
      summary.overwritten += result.overwritten;
      summary.ignored += result.ignored;
    }
  }
  return summary;
};
