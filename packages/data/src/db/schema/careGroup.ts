import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "./columns";

import type { SimpleTiles } from "./simpleMode";

import { jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { audits, id, timestamps } from "./columns";
import { simpleTilesZSchema } from "./simpleMode";

// The shared space care data belongs to: the caretakers looking after one
// care recipient (see careRecipient.ts). Access comes only from membership
// (careGroupMember.ts); the creator becomes its first owner.
export const careGroupSchema = pgTable("care_group", {
  id: id(),
  name: text("name").notNull(),
  // How simple mode picks its four tiles (simpleMode.ts); null: learned from use.
  simpleTiles: jsonb("simple_tiles").$type<SimpleTiles>(),
  ...timestamps,
  ...audits,
});

export type CareGroupSchema = typeof careGroupSchema;
export type CareGroupSelect = InferSelectModel<CareGroupSchema>;
export type CareGroupInsert = Omit<InferInsertModel<CareGroupSchema>, ProtectedField>;
export type CareGroupUpdate = Partial<CareGroupInsert>;
export type CareGroup = CareGroupSelect;

const name = z.string().trim().min(1).max(120);
const simpleTiles = simpleTilesZSchema.nullable();

export const careGroupSelectZSchema = createSelectSchema(careGroupSchema, { simpleTiles });
export const careGroupInsertZSchema = createInsertSchema(careGroupSchema, { name, simpleTiles });
export const careGroupUpdateZSchema = createUpdateSchema(careGroupSchema, { name, simpleTiles });
