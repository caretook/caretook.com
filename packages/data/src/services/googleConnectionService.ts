import type { Tx } from "../db";
import type { GoogleCalendarConnection, GoogleCalendarStatus } from "../db/schema";
import type { GoogleCalendarClient } from "../google";
import type { ServiceContext } from "./types";

import { randomUUID } from "node:crypto";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { SYSTEM_USER } from "../constants";
import { afterCommit, dbMayFail, getDb, txOrDb, withTransaction } from "../db";
import {
  calendarSyncJobSchema,
  careRecipientSchema,
  GOOGLE_OAUTH_STATE_MINUTES,
  googleCalendarConnectionSchema as connection,
  googleEventLinkSchema,
  googleOauthStateSchema as oauthState,
} from "../db/schema";
import { isError, newError } from "../errors";
import {
  getGoogleCalendarClient,
  hashState,
  inCalendarBackground,
  newOauthSecrets,
  oauthStateUsable,
} from "../google";
import { logError } from "../logging";
import { careGroupMemberModel } from "../models";
import { googleTokenKeyConfigured, openGoogleToken, sealGoogleToken } from "../utils/googleToken";
import * as calendarSyncService from "./calendarSyncService";

export const serviceName = "googleConnection";

// A member's Google Calendar connection for one care group (appointments-2,
// slice 7). Connect: `start` stores a state (hashed) and a PKCE verifier
// (sealed) for 10 minutes and gives Google's consent URL; the callback's
// `complete` checks that state is the member's and fresh, seals the refresh
// token (GOOGLE_TOKEN_KEY, the connection id as associated data), makes the
// "Caretook: <recipient>" calendar and queues a full push. `disconnect`
// revokes the token at Google, forgets it and stops syncing, and leaves the
// calendar in Google as it was. Leaving or being removed from the group
// disconnects in the removal's transaction. One live connection per member
// and group; viewers connect too (their calendar is kept current). No
// procedure ever returns a token.

type Opts = { client?: GoogleCalendarClient | null; now?: Date };

const SYSTEM = SYSTEM_USER.id;
const dbFails = <T>(run: () => PromiseLike<T>) => dbMayFail(run, "googleConnectionService:db");
const notMember = () => newError({ code: "googleConnectionService:notMember" });
const badState = () => newError({ code: "googleConnectionService:badState" });

const memberOf = async (ctx: ServiceContext, groupId: string, tx?: Tx) => {
  if (!ctx.authUser) return newError({ code: "permissions:unauthenticated" });
  const role = await careGroupMemberModel.getRole(groupId, ctx.authUser.id, { tx });
  if (isError(role)) return role;
  return role ? ctx.authUser.id : notMember();
};

/** Google set up here, and somewhere safe to keep its tokens. */
const ready = (client: GoogleCalendarClient | null | undefined) => {
  if (!client) return newError({ code: "googleConnectionService:notConfigured" });
  if (!googleTokenKeyConfigured()) return newError({ code: "googleConnectionService:keyMissing" });
  return client;
};

const liveConnection = (userId: string, groupId: string, tx?: Tx) =>
  dbFails(async () => {
    const [row] = await txOrDb(tx)
      .select()
      .from(connection)
      .where(
        and(
          eq(connection.userId, userId),
          eq(connection.groupId, groupId),
          isNull(connection.disconnectedAt),
        ),
      );
    return row ?? null;
  });

/** Whether Google can be connected in this process (the card's Connect). */
export const configured = (client: GoogleCalendarClient | null = getGoogleCalendarClient()) =>
  !isError(ready(client));

/**
 * Begin connecting `groupId`'s calendar for the actor: Google's consent URL,
 * with a state and PKCE kept for 10 minutes. Members only.
 */
export const start = async (ctx: ServiceContext, groupId: string, opts: Opts = {}) => {
  const client = ready(opts.client === undefined ? getGoogleCalendarClient() : opts.client);
  if (isError(client)) return client;
  const userId = await memberOf(ctx, groupId);
  if (isError(userId)) return userId;
  const now = opts.now ?? new Date();
  const { state, codeVerifier, codeChallenge } = newOauthSecrets();
  const id = randomUUID();
  const sealed = sealGoogleToken(codeVerifier, id);
  if (!sealed) return newError({ code: "googleConnectionService:keyMissing" });
  const saved = await dbFails(async () => {
    const db = getDb();
    // Old, unused Connects go as new ones start.
    await db.delete(oauthState).where(lt(oauthState.expiresAt, now.toISOString()));
    await db.insert(oauthState).values({
      id,
      userId,
      groupId,
      stateHash: hashState(state),
      codeVerifierSealed: sealed,
      expiresAt: new Date(now.getTime() + GOOGLE_OAUTH_STATE_MINUTES * 60_000).toISOString(),
      createdBy: userId,
      updatedBy: userId,
    });
  });
  if (isError(saved)) return saved;
  return { url: client.authUrl({ state, codeChallenge }), groupId };
};

/** The group a callback's state was made for (to send the member back there), if it's still known. */
export const stateGroup = async (state: string) => {
  const rows = await dbFails(() =>
    getDb()
      .select({ groupId: oauthState.groupId })
      .from(oauthState)
      .where(eq(oauthState.stateHash, hashState(state))),
  );
  return isError(rows) ? null : (rows[0]?.groupId ?? null);
};

/**
 * Finish connecting, from Google's callback: the state must be the actor's
 * and under 10 minutes old (it's used once either way). Seals the refresh
 * token, makes the calendar (or keeps the one a live connection has, when
 * reconnecting after an error) and queues a full push.
 */
export const complete = async (
  ctx: ServiceContext,
  { code, state }: { code: string; state: string },
  opts: Opts = {},
) => {
  const client = ready(opts.client === undefined ? getGoogleCalendarClient() : opts.client);
  if (isError(client)) return client;
  if (!ctx.authUser) return newError({ code: "permissions:unauthenticated" });
  const now = opts.now ?? new Date();

  const taken = await dbFails(() =>
    getDb()
      .delete(oauthState)
      .where(eq(oauthState.stateHash, hashState(state)))
      .returning(),
  );
  if (isError(taken)) return taken;
  const pending = taken[0];
  if (!pending || !oauthStateUsable(pending, ctx.authUser.id, now)) return badState();
  const userId = await memberOf(ctx, pending.groupId);
  if (isError(userId)) return userId;
  const codeVerifier = openGoogleToken(pending.codeVerifierSealed, pending.id);
  if (!codeVerifier) return badState();

  const tokens = await client.exchangeCode({ code, codeVerifier });
  if (isError(tokens)) return tokens;
  if (!tokens.refreshToken) return newError({ code: "googleConnectionService:noRefreshToken" });
  const session = await client.refresh(tokens.refreshToken);
  if (isError(session)) return session;

  const existing = await liveConnection(userId, pending.groupId);
  if (isError(existing)) return existing;
  let calendarId = existing?.calendarId;
  let calendarName = existing?.calendarName;
  if (!existing) {
    const recipients = await dbFails(() =>
      getDb()
        .select({
          name: careRecipientSchema.name,
          preferredName: careRecipientSchema.preferredName,
          timeZone: careRecipientSchema.timeZone,
        })
        .from(careRecipientSchema)
        .where(eq(careRecipientSchema.groupId, pending.groupId)),
    );
    if (isError(recipients)) return recipients;
    const recipient = recipients[0];
    calendarName = `Caretook: ${recipient?.preferredName?.trim() || recipient?.name || "care group"}`;
    const made = await session.createCalendar({
      summary: calendarName,
      timeZone: recipient?.timeZone ?? "UTC",
    });
    if (isError(made)) return made;
    calendarId = made.id;
  }

  const id = existing?.id ?? randomUUID();
  const sealed = sealGoogleToken(tokens.refreshToken, id);
  if (!sealed) return newError({ code: "googleConnectionService:keyMissing" });
  const saved = await withTransaction(async (tx) => {
    const db = txOrDb(tx);
    const written = await dbFails(() =>
      existing
        ? db
            .update(connection)
            .set({ refreshTokenSealed: sealed, lastError: null, lastErrorAt: null, updatedBy: userId })
            .where(eq(connection.id, id))
        : db.insert(connection).values({
            id,
            userId,
            groupId: pending.groupId,
            calendarId: calendarId!,
            calendarName: calendarName!,
            refreshTokenSealed: sealed,
            createdBy: userId,
            updatedBy: userId,
          }),
    );
    if (isError(written)) return written;
    const queued = await calendarSyncService.enqueue(tx, { connectionId: id }, "connect");
    return queued ?? { id };
  }, ctx);
  if (isError(saved)) return saved;
  return { groupId: pending.groupId, connectionId: id, calendarName: calendarName! };
};

const statusOf = (row: GoogleCalendarConnection | null, isConfigured: boolean): GoogleCalendarStatus =>
  row
    ? {
        connected: true,
        configured: isConfigured,
        calendarName: row.calendarName,
        lastPushedAt: row.lastPushedAt ? new Date(row.lastPushedAt).toISOString() : null,
        lastPulledAt: row.lastPulledAt ? new Date(row.lastPulledAt).toISOString() : null,
        error: row.lastError,
      }
    : { connected: false, configured: isConfigured };

/** The actor's connection for `groupId`, as the card shows it: never a token. Members only. */
export const status = async (ctx: ServiceContext, groupId: string, opts: Opts = {}) => {
  const userId = await memberOf(ctx, groupId);
  if (isError(userId)) return userId;
  const row = await liveConnection(userId, groupId);
  if (isError(row)) return row;
  return statusOf(row, configured(opts.client === undefined ? getGoogleCalendarClient() : opts.client));
};

/**
 * Stop syncing `conn` inside `tx`: forget its tokens, its links and waiting
 * jobs, and mark it disconnected; the calendar stays in Google. Returns the
 * refresh token to revoke once this commits (or null).
 */
const forget = async (tx: Tx, conn: GoogleCalendarConnection, by: string) => {
  const db = txOrDb(tx);
  const token = conn.refreshTokenSealed ? openGoogleToken(conn.refreshTokenSealed, conn.id) : null;
  const done = await dbFails(async () => {
    await db
      .update(connection)
      .set({ refreshTokenSealed: null, syncToken: null, disconnectedAt: sql`now()`, updatedBy: by })
      .where(eq(connection.id, conn.id));
    await db.delete(googleEventLinkSchema).where(eq(googleEventLinkSchema.connectionId, conn.id));
    await db.delete(calendarSyncJobSchema).where(eq(calendarSyncJobSchema.connectionId, conn.id));
  });
  return isError(done) ? done : token;
};

/** Revoke at Google after commit, in the background; a failure is logged (the token is forgotten either way). */
const revokeAfter = (tx: Tx, token: string | null, client: GoogleCalendarClient | null) => {
  if (!token || !client) return;
  afterCommit(tx, () =>
    inCalendarBackground(async () => {
      const revoked = await client.revoke(token);
      if (isError(revoked)) logError("calendars: Google revoke failed", revoked);
    }),
  );
};

/**
 * The actor disconnects Google for `groupId`: the token is revoked at
 * Google and forgotten, syncing stops, and the calendar stays in Google.
 */
export const disconnect = async (ctx: ServiceContext, groupId: string, opts: Opts = {}) => {
  const client = opts.client === undefined ? getGoogleCalendarClient() : opts.client;
  const userId = await memberOf(ctx, groupId);
  if (isError(userId)) return userId;
  const row = await liveConnection(userId, groupId);
  if (isError(row)) return row;
  if (!row) return newError({ code: "googleConnectionService:notConnected" });
  const token = await withTransaction((tx) => forget(tx, row, userId), ctx);
  if (isError(token)) return token;
  // Awaited here (the member asked), unlike a removal's.
  if (token && client) {
    const revoked = await client.revoke(token);
    if (isError(revoked)) logError("calendars: Google revoke failed", revoked, { recordId: row.id });
  }
  return { groupId, connected: false as const };
};

/**
 * A member leaving or removed: their Google connection in `groupId` is
 * disconnected in the removal's transaction, and its token revoked once
 * that commits.
 */
export const disconnectForMember = async (
  tx: Tx,
  groupId: string,
  userId: string,
  opts: Pick<Opts, "client"> = {},
) => {
  const row = await liveConnection(userId, groupId, tx);
  if (isError(row)) return row;
  if (!row) return null;
  const token = await forget(tx, row, SYSTEM);
  if (isError(token)) return token;
  revokeAfter(tx, token, opts.client === undefined ? getGoogleCalendarClient() : opts.client);
  return null;
};
