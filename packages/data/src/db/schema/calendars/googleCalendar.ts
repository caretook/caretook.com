import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { userSchema } from "../auth/user";
import { careGroupSchema } from "../care-groups/careGroup";
import { audits, enumCheck, id, timestamps } from "../core/columns";

// Google Calendar (appointments-2, slice 7): a member's connection for one
// care group, the events Caretook keeps in its own "Caretook: <recipient>"
// calendar there, the push jobs, and the short-lived OAuth state. Server
// only and system only (see PERMISSIONS): written by googleConnectionService
// and calendarSyncService, never through a model, and nothing here syncs.
// The refresh token is sealed (AES-256-GCM, GOOGLE_TOKEN_KEY, the connection
// id as associated data) and never logged or returned.

const timestampColumn = (name: string) =>
  timestamp(name, { precision: 3, mode: "string", withTimezone: true });

/**
 * Why a connection stopped syncing: Google refused its token (`revoked`:
 * "Reconnect Google"), or the calendar is gone from Google (`calendarGone`).
 * A passing failure isn't recorded here: its job retries.
 */
export const GOOGLE_CONNECTION_ERRORS = ["revoked", "calendarGone"] as const;
export type GoogleConnectionError = (typeof GOOGLE_CONNECTION_ERRORS)[number];

/** One member's Google connection for one group. One live (not disconnected) per member and group. */
export const googleCalendarConnectionSchema = pgTable(
  "google_calendar_connection",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userSchema.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    // Caretook's own calendar in the member's Google account, and its name there.
    calendarId: text("calendar_id").notNull(),
    calendarName: text("calendar_name").notNull(),
    // base64url(iv | tag | ciphertext); null once disconnected.
    refreshTokenSealed: text("refresh_token_sealed"),
    // Google's sync token for pulling changes (slice 9).
    syncToken: text("sync_token"),
    lastPushedAt: timestampColumn("last_pushed_at"),
    lastPulledAt: timestampColumn("last_pulled_at"),
    lastError: text("last_error", { enum: GOOGLE_CONNECTION_ERRORS }),
    lastErrorAt: timestampColumn("last_error_at"),
    disconnectedAt: timestampColumn("disconnected_at"),
    ...timestamps,
    ...audits,
  },
  (t) => [
    uniqueIndex("google_calendar_connection_live_unique")
      .on(t.userId, t.groupId)
      .where(sql`${t.disconnectedAt} IS NULL`),
    index("google_calendar_connection_group_idx").on(t.groupId),
    // A null passes the check (NULL IN (…) isn't false).
    enumCheck("google_calendar_connection_last_error_check", t.lastError, GOOGLE_CONNECTION_ERRORS),
  ],
);

/** One calendar item (`entry:<id>`, `todo:<id>`) as an event in a connection's calendar. */
export const googleEventLinkSchema = pgTable(
  "google_event_link",
  {
    id: id(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => googleCalendarConnectionSchema.id, { onDelete: "cascade" }),
    itemUid: text("item_uid").notNull(),
    googleEventId: text("google_event_id").notNull(),
    etag: text("etag"),
    // SHA-256 of the event as last pushed: an unchanged item makes no call.
    pushedHash: text("pushed_hash").notNull(),
    ...timestamps,
    ...audits,
  },
  (t) => [uniqueIndex("google_event_link_connection_item_unique").on(t.connectionId, t.itemUid)],
);

/** Why a push was queued. */
export const CALENDAR_SYNC_REASONS = ["entry", "todo", "series", "consent", "connect", "daily"] as const;
export type CalendarSyncReason = (typeof CALENDAR_SYNC_REASONS)[number];

/**
 * A push to do: every live connection in a group (an item changed), or one
 * connection (connected, its consent changed, the daily refresh). At most
 * one waiting job per group and per connection; a claimed one makes room
 * for the next change.
 */
export const calendarSyncJobSchema = pgTable(
  "calendar_sync_job",
  {
    id: id(),
    groupId: uuid("group_id").references(() => careGroupSchema.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").references(() => googleCalendarConnectionSchema.id, {
      onDelete: "cascade",
    }),
    reason: text("reason", { enum: CALENDAR_SYNC_REASONS }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestampColumn("next_attempt_at").notNull().defaultNow(),
    claimedAt: timestampColumn("claimed_at"),
    lastError: text("last_error"),
    ...timestamps,
    ...audits,
  },
  (t) => [
    uniqueIndex("calendar_sync_job_group_waiting_unique")
      .on(t.groupId)
      .where(sql`${t.claimedAt} IS NULL AND ${t.groupId} IS NOT NULL`),
    uniqueIndex("calendar_sync_job_connection_waiting_unique")
      .on(t.connectionId)
      .where(sql`${t.claimedAt} IS NULL AND ${t.connectionId} IS NOT NULL`),
    index("calendar_sync_job_due_idx").on(t.nextAttemptAt),
    enumCheck("calendar_sync_job_reason_check", t.reason, CALENDAR_SYNC_REASONS),
    check("calendar_sync_job_target_check", sql`num_nonnulls(${t.groupId}, ${t.connectionId}) = 1`),
  ],
);

/** How long a Connect has to come back from Google. */
export const GOOGLE_OAUTH_STATE_MINUTES = 10;

/** A Connect in progress: its state (hashed) and PKCE verifier (sealed), for 10 minutes. */
export const googleOauthStateSchema = pgTable(
  "google_oauth_state",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userSchema.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    stateHash: text("state_hash").notNull().unique(),
    codeVerifierSealed: text("code_verifier_sealed").notNull(),
    expiresAt: timestampColumn("expires_at").notNull(),
    ...timestamps,
    ...audits,
  },
  (t) => [index("google_oauth_state_expires_idx").on(t.expiresAt)],
);

export type GoogleCalendarConnection = InferSelectModel<typeof googleCalendarConnectionSchema>;
export type GoogleCalendarConnectionInsert = InferInsertModel<typeof googleCalendarConnectionSchema>;
export type GoogleEventLink = InferSelectModel<typeof googleEventLinkSchema>;
export type CalendarSyncJob = InferSelectModel<typeof calendarSyncJobSchema>;
export type GoogleOauthState = InferSelectModel<typeof googleOauthStateSchema>;

/** What the Google card shows of a member's connection (never a token). Client-safe. */
export type GoogleCalendarStatus =
  | { connected: false; configured: boolean }
  | {
      connected: true;
      configured: boolean;
      calendarName: string;
      lastPushedAt: string | null;
      lastPulledAt: string | null;
      error: GoogleConnectionError | null;
    };
