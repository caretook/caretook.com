import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { audits, enumCheck, id, timestamps } from "../core/columns";
import { staffReasonZSchema } from "../admin/staffRules";

// Addresses we no longer mail (hosting PRD, slice 4): a hard bounce or a
// spam complaint reported by Resend's webhook suppresses the address, and
// `notify`'s delivery skips it (sign-in mail excepted). Staff can clear one
// (`users.help`, with a reason, audited), which keeps the row as history.
// The system's only (see PERMISSIONS): written by emailSuppressionService,
// never through a model, and nothing about it syncs to devices.

export const SUPPRESSION_REASONS = ["bounce", "complaint"] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

const timestampColumn = (name: string) =>
  timestamp(name, { precision: 3, mode: "string", withTimezone: true });

export const emailSuppressionSchema = pgTable(
  "email_suppression",
  {
    id: id(),
    // Lower-cased and trimmed (the check holds it).
    address: text("address").notNull(),
    reason: text("reason", { enum: SUPPRESSION_REASONS }).notNull(),
    // The webhook event (Svix message id) that suppressed it: a replay changes nothing.
    eventId: text("event_id").notNull().unique(),
    clearedAt: timestampColumn("cleared_at"),
    // The staff member who cleared it (null for the system). No FK, as with audits.
    clearedBy: uuid("cleared_by"),
    clearReason: text("clear_reason"),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // One active suppression per address; cleared ones stay as history.
    uniqueIndex("email_suppression_active_address_idx")
      .on(t.address)
      .where(sql`${t.clearedAt} IS NULL`),
    index("email_suppression_created_at_idx").on(t.createdAt),
    enumCheck("email_suppression_reason_check", t.reason, SUPPRESSION_REASONS),
    check("email_suppression_address_check", sql`${t.address} = lower(btrim(${t.address}))`),
  ],
);

export type EmailSuppressionSchema = typeof emailSuppressionSchema;
export type EmailSuppression = InferSelectModel<EmailSuppressionSchema>;
export type EmailSuppressionInsert = InferInsertModel<EmailSuppressionSchema>;

/** How an address is stored and compared. */
export const normalizeAddress = (address: string) => address.trim().toLowerCase();

/** Suppressions per page on /admin/suppressions. */
export const SUPPRESSION_PAGE_SIZE = 50;

/** The longest search /admin/suppressions takes. */
export const SUPPRESSION_QUERY_MAX = 254;

/** A search of the active suppressions: part of an address (none lists them all), and a page. */
export const suppressionSearchZSchema = z.object({
  query: z.string().trim().max(SUPPRESSION_QUERY_MAX).optional(),
  page: z.number().int().min(1).max(100_000).default(1),
});
export type SuppressionSearchInput = z.input<typeof suppressionSearchZSchema>;

/** Clearing one address's suppression, and why (1–500 characters). */
export const clearSuppressionZSchema = z.object({
  address: z.string().trim().min(1, "Required").max(SUPPRESSION_QUERY_MAX),
  reason: staffReasonZSchema,
});
export type ClearSuppressionInput = z.input<typeof clearSuppressionZSchema>;
