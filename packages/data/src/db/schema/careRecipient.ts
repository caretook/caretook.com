import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "./columns";

import { date, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { careGroupSchema } from "./careGroup";
import { audits, id, timestamps } from "./columns";

// The person a care group looks after: a profile, not an account. Exactly
// one per group for now (the unique group_id); dropping that constraint is
// all it takes to allow several later.
export const careRecipientSchema = pgTable(
  "care_recipient",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .unique()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    preferredName: text("preferred_name"),
    dateOfBirth: date("date_of_birth", { mode: "string" }),
    notes: text("notes"),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // Target of composite FKs (e.g. timeline_entry), so the database itself
    // guarantees a row's recipient belongs to the row's group.
    unique("care_recipient_group_id_id_unique").on(t.groupId, t.id),
  ],
);

export type CareRecipientSchema = typeof careRecipientSchema;
export type CareRecipientSelect = InferSelectModel<CareRecipientSchema>;
export type CareRecipientInsert = Omit<InferInsertModel<CareRecipientSchema>, ProtectedField>;
export type CareRecipientUpdate = Partial<CareRecipientInsert>;
export type CareRecipient = CareRecipientSelect;

const name = z.string().trim().min(1).max(120);
const preferredName = z.string().trim().max(120).nullish();
const dateOfBirth = z.iso.date().nullish();

export const careRecipientSelectZSchema = createSelectSchema(careRecipientSchema);
export const careRecipientInsertZSchema = createInsertSchema(careRecipientSchema, {
  name,
  preferredName,
  dateOfBirth,
});
export const careRecipientUpdateZSchema = createUpdateSchema(careRecipientSchema, {
  name,
  preferredName,
  dateOfBirth,
});

/**
 * The profile fields group settings edits. Each is optional: what's left out
 * keeps its value. (`partial()` because a column override stays required in
 * drizzle-zod's update schema.)
 */
export const careRecipientProfileZSchema = careRecipientUpdateZSchema
  .pick({ name: true, preferredName: true, dateOfBirth: true })
  .partial();
export type CareRecipientProfileInput = z.infer<typeof careRecipientProfileZSchema>;
