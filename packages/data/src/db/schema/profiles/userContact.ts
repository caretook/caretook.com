import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";
import type { ContactPhone } from "../core/contactFields";

import { jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { audits, id, timestamps } from "../core/columns";
import { contactPhonesZSchema, optionalAddressZSchema, optionalEmailZSchema } from "../core/contactFields";
import { userSchema } from "../auth/user";

// A member's own contact details (profiles), entered once on their account:
// phones, a contact email (never their sign-in email unless they type it
// here) and an address. Only the user reads or writes it, and it never
// leaves Postgres through replication: each group sees only what the member
// shares with it, through `member_contact_share`.
export const userContactSchema = pgTable("user_contact", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => userSchema.id, { onDelete: "cascade" }),
  phones: jsonb("phones").$type<ContactPhone[]>().notNull().default([]),
  contactEmail: text("contact_email"),
  // Multi-line.
  address: text("address"),
  ...timestamps,
  ...audits,
});

export type UserContactSchema = typeof userContactSchema;
export type UserContactSelect = InferSelectModel<UserContactSchema>;
export type UserContactInsert = Omit<InferInsertModel<UserContactSchema>, ProtectedField>;
export type UserContact = UserContactSelect;

/** The values a member's contact details hold (none entered: empty). */
export type ContactValues = {
  phones: ContactPhone[];
  contactEmail: string | null;
  address: string | null;
};

export const EMPTY_CONTACT: ContactValues = { phones: [], contactEmail: null, address: null };

/** What the Contact details page edits. Fields left out keep their value; empty clears. */
export const userContactUpdateZSchema = z.strictObject({
  phones: contactPhonesZSchema.optional(),
  contactEmail: optionalEmailZSchema.optional(),
  address: optionalAddressZSchema.optional(),
});
export type UserContactUpdateInput = z.input<typeof userContactUpdateZSchema>;
