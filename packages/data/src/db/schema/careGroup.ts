import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "./columns";

import { pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { audits, id, timestamps } from "./columns";

// The shared space care data belongs to: the caretakers looking after one
// care recipient (see careRecipient.ts). Access comes only from membership
// (careGroupMember.ts); the creator becomes its first owner.
export const careGroupSchema = pgTable("care_group", {
  id: id(),
  name: text("name").notNull(),
  ...timestamps,
  ...audits,
});

export type CareGroupSchema = typeof careGroupSchema;
export type CareGroupSelect = InferSelectModel<CareGroupSchema>;
export type CareGroupInsert = Omit<InferInsertModel<CareGroupSchema>, ProtectedField>;
export type CareGroupUpdate = Partial<CareGroupInsert>;
export type CareGroup = CareGroupSelect;

const name = z.string().trim().min(1).max(120);

export const careGroupSelectZSchema = createSelectSchema(careGroupSchema);
export const careGroupInsertZSchema = createInsertSchema(careGroupSchema, { name });
export const careGroupUpdateZSchema = createUpdateSchema(careGroupSchema, { name });
