import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "./columns";

import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { careGroupSchema } from "./careGroup";
import { audits, id, timestamps } from "./columns";
import { userSchema } from "./user";

// Access codes: staff-made tickets for starting a new care group (invites
// slice 5). Someone with a code creates an account and their own group, as
// its owner, at /join/:code. Codes are multi-use, with a label (where they
// were handed out), an expiry and an optional maximum number of uses.
//
// The code is stored as it's printed (not hashed): staff print it again from
// /admin at any time, and it's a sign-up ticket, not health data or a
// secret about anyone. Only staff (global admin) and the system can read it.

export const accessCodeSchema = pgTable(
  "access_code",
  {
    id: id(),
    /** `CARE-7K3M-Q9TD`: three groups of four, uppercase (see `normalizeAccessCode`). */
    code: text("code").notNull(),
    label: text("label").notNull(),
    expiresAt: timestamp("expires_at", { precision: 3, mode: "string", withTimezone: true }).notNull(),
    /** Null: no limit. */
    maxUses: integer("max_uses"),
    useCount: integer("use_count").notNull().default(0),
    revokedAt: timestamp("revoked_at", { precision: 3, mode: "string", withTimezone: true }),
    ...timestamps,
    ...audits,
  },
  (t) => [
    uniqueIndex("access_code_code_unique").on(t.code),
    check("access_code_code_format", sql`${t.code} ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$'`),
    check("access_code_max_uses_check", sql`${t.maxUses} IS NULL OR ${t.maxUses} > 0`),
  ],
);

// Who used a code, and the group it started. The group is kept null when the
// group is deleted later, so the count of redemptions stays.
export const accessCodeRedemptionSchema = pgTable(
  "access_code_redemption",
  {
    id: id(),
    codeId: uuid("code_id")
      .notNull()
      .references(() => accessCodeSchema.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => userSchema.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => careGroupSchema.id, { onDelete: "set null" }),
    ...timestamps,
    ...audits,
  },
  (t) => [index("access_code_redemption_code_idx").on(t.codeId)],
);

export type AccessCodeSchema = typeof accessCodeSchema;
export type AccessCode = InferSelectModel<AccessCodeSchema>;
export type AccessCodeInsert = Omit<InferInsertModel<AccessCodeSchema>, ProtectedField>;
export type AccessCodeRedemptionSchema = typeof accessCodeRedemptionSchema;
export type AccessCodeRedemption = InferSelectModel<AccessCodeRedemptionSchema>;
export type AccessCodeRedemptionInsert = Omit<InferInsertModel<AccessCodeRedemptionSchema>, ProtectedField>;

// ---------------------------------------------------------------------------
// Pure rules (client-safe): the code's shape and its state.
// ---------------------------------------------------------------------------

/** Letters and digits that can't be mistaken for each other (no 0/O, 1/I/L). */
export const ACCESS_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const GROUP = 4;
const GROUPS = 3;

/**
 * A code as stored, from what someone typed or scanned: case, spaces and
 * dashes don't matter (`care 7k3m q9td` → `CARE-7K3M-Q9TD`). Null when it
 * can't be a code.
 */
export const normalizeAccessCode = (input: string): string | null => {
  const chars = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (chars.length !== GROUP * GROUPS) return null;
  return Array.from({ length: GROUPS }, (_, i) => chars.slice(i * GROUP, (i + 1) * GROUP)).join("-");
};

/** A new code, `CARE-XXXX-XXXX`, from `random` (crypto bytes on the server). */
export const formatAccessCode = (random: Uint8Array): string => {
  const pick = (i: number) => ACCESS_CODE_ALPHABET[(random[i] ?? 0) % ACCESS_CODE_ALPHABET.length];
  const body = Array.from({ length: GROUP * 2 }, (_, i) => pick(i)).join("");
  return `CARE-${body.slice(0, GROUP)}-${body.slice(GROUP)}`;
};

export const ACCESS_CODE_STATES = ["usable", "expired", "revoked", "usedUp"] as const;
export type AccessCodeState = (typeof ACCESS_CODE_STATES)[number];

/** Whether a code can start a group `now`. Revoked wins over expired, and expired over used up. */
export const codeState = ({
  code,
  now = new Date(),
}: {
  code: {
    expiresAt: string | Date;
    revokedAt?: string | Date | null;
    maxUses?: number | null;
    useCount?: number | null;
  };
  now?: Date;
}): AccessCodeState => {
  if (code.revokedAt) return "revoked";
  if (new Date(code.expiresAt).getTime() <= now.getTime()) return "expired";
  if (code.maxUses != null && (code.useCount ?? 0) >= code.maxUses) return "usedUp";
  return "usable";
};

/** What staff fill in to make a code. */
export const accessCodeCreateZSchema = z.object({
  label: z.string().trim().min(1, "Give the code a label").max(100),
  expiresInDays: z.coerce.number().int().min(1, "At least 1 day").max(730, "At most 2 years"),
  maxUses: z.coerce.number().int().min(1, "At least 1").max(100_000).nullish(),
});
export type AccessCodeCreateInput = z.infer<typeof accessCodeCreateZSchema>;
