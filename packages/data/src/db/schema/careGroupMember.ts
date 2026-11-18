import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "./columns";

import { index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { GROUP_ROLE_NAMES } from "../../constants/roles";
import { careGroupSchema } from "./careGroup";
import { audits, enumCheck, id, timestamps } from "./columns";
import { userSchema } from "./user";

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
    ...timestamps,
    ...audits,
  },
  (t) => [
    unique("care_group_member_group_user_unique").on(t.groupId, t.userId),
    // The permission subqueries look up memberships by user.
    index("care_group_member_user_idx").on(t.userId),
    enumCheck("care_group_member_role_check", t.role, GROUP_ROLE_NAMES),
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
