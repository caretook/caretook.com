import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "./columns";
import type { WaitlistSource } from "./publicFormRules";

import { sql } from "drizzle-orm";
import { check, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { audits, enumCheck, id, timestamps } from "./columns";
import { CARING_FOR, HEARD_FROM_MAX } from "./publicFormRules";

// Someone waiting to start using Caretook (marketing slice 4), from the
// marketing site's waitlist form. One row per address: the email is stored
// trimmed and lowercased (a check enforces it), so the unique index is
// case-insensitive, and joining again updates the row. No IP address or user
// agent is stored. Written only by the system (waitlistService.join); staff
// (global admin) read it.
export const waitlistEntrySchema = pgTable(
  "waitlist_entry",
  {
    id: id(),
    email: text("email").notNull(),
    firstName: text("first_name"),
    caringFor: text("caring_for", { enum: CARING_FOR }),
    heardFrom: text("heard_from"),
    /** The page and UTM parameters they joined from. */
    source: jsonb("source").$type<WaitlistSource>(),
    ...timestamps,
    ...audits,
  },
  (t) => [
    uniqueIndex("waitlist_entry_email_unique").on(t.email),
    check("waitlist_entry_email_lower", sql`${t.email} = lower(${t.email})`),
    enumCheck("waitlist_entry_caring_for_check", t.caringFor, CARING_FOR),
    check(
      "waitlist_entry_heard_from_length",
      sql`char_length(${t.heardFrom}) <= ${sql.raw(String(HEARD_FROM_MAX))}`,
    ),
  ],
);

export type WaitlistEntrySchema = typeof waitlistEntrySchema;
export type WaitlistEntry = InferSelectModel<WaitlistEntrySchema>;
export type WaitlistEntryInsert = Omit<InferInsertModel<WaitlistEntrySchema>, ProtectedField>;
