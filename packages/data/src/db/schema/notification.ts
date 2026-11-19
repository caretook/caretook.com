import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { audits, enumCheck, id, timestamps } from "./columns";

// Tables for @caretook/notifications (packages/notifications). Both are the
// system's only (see PERMISSIONS): the package reads and writes them directly,
// never through a model, and nothing about them syncs to devices.

const timestampColumn = (name: string) =>
  timestamp(name, { precision: 3, mode: "string", withTimezone: true });

// pending → sending → sent | skipped (not on MAIL_ALLOWLIST outside
// production), or back to pending with a later next_attempt_at after a failed
// send, and failed after the last attempt.
export const OUTBOX_STATUSES = ["pending", "sending", "sent", "skipped", "failed"] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

// One email to send. Written by notify() in the caller's transaction, so the
// change and its email commit (or roll back) together, already rendered: a
// later template change never alters a queued message. The idempotency key is
// unique here and is also passed to Resend, so one message is sent once.
export const notificationOutboxSchema = pgTable(
  "notification_outbox",
  {
    id: id(),
    // The notification's name in NOTIFICATIONS, e.g. "testMessage".
    name: text("name").notNull(),
    recipient: text("recipient").notNull(),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    text: text("text").notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    status: text("status", { enum: OUTBOX_STATUSES }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestampColumn("next_attempt_at").defaultNow().notNull(),
    // When a sweep took the row; a row left in `sending` long after this
    // (a crashed sweep) is taken again.
    claimedAt: timestampColumn("claimed_at"),
    sentAt: timestampColumn("sent_at"),
    lastError: text("last_error"),
    // The sender's message id (Resend's), when it gives one.
    providerMessageId: text("provider_message_id"),
    ...timestamps,
    ...audits,
  },
  (t) => [
    index("notification_outbox_due_idx").on(t.status, t.nextAttemptAt),
    index("notification_outbox_sent_at_idx").on(t.sentAt),
    enumCheck("notification_outbox_status_check", t.status, OUTBOX_STATUSES),
    check("notification_outbox_attempts_check", sql`${t.attempts} >= 0`),
  ],
);

export type NotificationOutboxSchema = typeof notificationOutboxSchema;
export type NotificationOutboxSelect = InferSelectModel<NotificationOutboxSchema>;
export type NotificationOutboxInsert = InferInsertModel<NotificationOutboxSchema>;
export type NotificationOutbox = NotificationOutboxSelect;

// The dev mailbox: what the `log` sender "sent", for /dev/mail and the
// browser checks. Used only outside production; `datastore:reset` empties it
// (it drops the schema).
export const devMailSchema = pgTable(
  "dev_mail",
  {
    id: id(),
    name: text("name").notNull(),
    sender: text("sender").notNull(),
    recipient: text("recipient").notNull(),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    text: text("text").notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    ...timestamps,
    ...audits,
  },
  (t) => [index("dev_mail_recipient_idx").on(t.recipient), index("dev_mail_created_at_idx").on(t.createdAt)],
);

export type DevMailSchema = typeof devMailSchema;
export type DevMailSelect = InferSelectModel<DevMailSchema>;
export type DevMail = DevMailSelect;
