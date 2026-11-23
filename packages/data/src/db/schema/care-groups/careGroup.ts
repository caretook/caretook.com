import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";

import type { EasyTiles } from "../app-shell/easyMode";

import { boolean, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { audits, id, timestamps } from "../core/columns";
import { easyTilesZSchema } from "../app-shell/easyMode";

// The shared space care data belongs to: the caretakers looking after one
// care recipient (see careRecipient.ts). Access comes only from membership
// (careGroupMember.ts); the creator becomes its first owner.
export const careGroupSchema = pgTable("care_group", {
  id: id(),
  name: text("name").notNull(),
  // How easy mode picks its four tiles (easyMode.ts); null: learned from use.
  easyTiles: jsonb("easy_tiles").$type<EasyTiles>(),
  // Retired by easy_tiles (simple-mode PRD, slice 1): no longer read or written; a later contract
  // migration drops it.
  simpleTiles: jsonb("simple_tiles").$type<EasyTiles>(),
  // Members may connect their own AI assistant (connectors PRD): off until
  // an owner turns it on (careGroupService.update); off revokes every grant.
  connectorsEnabled: boolean("connectors_enabled").notNull().default(false),
  // An owner's choice that assistants only read (assistant-access). Grants
  // keep their stored scope, so switching back restores writing.
  connectorsReadOnly: boolean("connectors_read_only").notNull().default(false),
  // Members may opt in to titles, places and providers in their emails,
  // feed and Google calendar (appointments-2). Owners turn it off for
  // everyone (calendarSettingService.setDetailsAllowed); not synced.
  detailsOutsideAllowed: boolean("details_outside_allowed").notNull().default(true),
  ...timestamps,
  ...audits,
});

export type CareGroupSchema = typeof careGroupSchema;
export type CareGroupSelect = InferSelectModel<CareGroupSchema>;
export type CareGroupInsert = Omit<InferInsertModel<CareGroupSchema>, ProtectedField>;
export type CareGroupUpdate = Partial<CareGroupInsert>;
export type CareGroup = CareGroupSelect;

const name = z.string().trim().min(1).max(120);
const easyTiles = easyTilesZSchema.nullable();

export const careGroupSelectZSchema = createSelectSchema(careGroupSchema, { easyTiles });
export const careGroupInsertZSchema = createInsertSchema(careGroupSchema, { name, easyTiles });
export const careGroupUpdateZSchema = createUpdateSchema(careGroupSchema, { name, easyTiles });
