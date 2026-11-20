import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "./columns";

import type { SharedField } from "./memberContactShare";

import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { GROUP_ROLE_NAMES } from "../../constants/roles";
import { careGroupSchema } from "./careGroup";
import { audits, enumCheck, id, timestamps } from "./columns";
import { userSchema } from "./user";

const timestampColumn = (name: string) =>
  timestamp(name, { precision: 3, mode: "string", withTimezone: true });

// Membership: which users belong to which care group, and with what group
// role. Every `group` permission scope is a subquery on this table.
export const careGroupMemberSchema = pgTable(
  "care_group_member",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => userSchema.id, { onDelete: "cascade" }),
    role: text("role", { enum: GROUP_ROLE_NAMES }).notNull(),
    // Who sent the invite this member joined through (null: added another
    // way, such as founding the group). Set by the system on acceptance.
    invitedBy: uuid("invited_by").references(() => userSchema.id, { onDelete: "set null" }),
    // How the member is related to the recipient ("daughter", "aide from
    // Sunrise"), and which of their contact details this group sees
    // (`member_contact_share` holds the values). Both set by the member,
    // through memberSharingService.
    relationship: text("relationship"),
    sharedFields: jsonb("shared_fields").$type<SharedField[]>().notNull().default([]),
    // The member's place on the emergency list (one order with outside
    // contacts), and whether they're the primary contact providers call. Set
    // by owners and admins, through emergencyContactService; only members
    // sharing a phone may have either.
    emergencyRank: integer("emergency_rank"),
    isPrimaryContact: boolean("is_primary_contact").notNull().default(false),
    // When the member fell off the emergency list because they stopped
    // sharing a phone (null: they didn't). Managers see a note on the profile
    // until they're back on the list or a manager saves the list. System only.
    emergencyDroppedAt: timestampColumn("emergency_dropped_at"),
    // Simple mode (simpleMode.ts): the owner's default for this member, and
    // whether they're locked in it (a lock means simple). Set by owners and
    // admins, through careGroupMemberService.setMode; only owners change an
    // owner's, and nobody their own lock.
    simpleMode: boolean("simple_mode").notNull().default(false),
    simpleModeLocked: boolean("simple_mode_locked").notNull().default(false),
    ...timestamps,
    ...audits,
  },
  (t) => [
    unique("care_group_member_group_user_unique").on(t.groupId, t.userId),
    // The permission subqueries look up memberships by user.
    index("care_group_member_user_idx").on(t.userId),
    enumCheck("care_group_member_role_check", t.role, GROUP_ROLE_NAMES),
    // At most one primary contact per group.
    uniqueIndex("care_group_member_primary_contact_unique")
      .on(t.groupId)
      .where(sql`${t.isPrimaryContact}`),
  ],
);

export type CareGroupMemberSchema = typeof careGroupMemberSchema;
export type CareGroupMemberSelect = InferSelectModel<CareGroupMemberSchema>;
export type CareGroupMemberInsert = Omit<InferInsertModel<CareGroupMemberSchema>, ProtectedField>;
export type CareGroupMemberUpdate = Partial<CareGroupMemberInsert>;
export type CareGroupMember = CareGroupMemberSelect;

export const careGroupMemberSelectZSchema = createSelectSchema(careGroupMemberSchema);
export const careGroupMemberInsertZSchema = createInsertSchema(careGroupMemberSchema);
export const careGroupMemberUpdateZSchema = createUpdateSchema(careGroupMemberSchema);
