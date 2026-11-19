import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "./columns";

import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { careGroupSchema } from "./careGroup";
import { careGroupInviteSchema } from "./careGroupInvite";
import { audits, enumCheck, id, timestamps } from "./columns";
import { LINK_ROLES } from "./inviteRules";
import { userSchema } from "./user";

export const JOIN_REQUEST_STATUSES = ["pending", "approved", "declined", "withdrawn"] as const;
export type JoinRequestStatus = (typeof JOIN_REQUEST_STATUSES)[number];

// Someone who used an invite link asking to join a care group (invites
// slice 4). They see nothing of the group until an owner or admin approves,
// which makes them a member with `role` (a link's role: caretaker or viewer
// only). Written only by the system, inside joinRequestService and
// careGroupInviteService.accept. Not synced: owners and admins read the
// group's requests, and the requester their own, through the API.
export const careGroupJoinRequestSchema = pgTable(
  "care_group_join_request",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => userSchema.id, { onDelete: "cascade" }),
    inviteId: uuid("invite_id").references(() => careGroupInviteSchema.id, { onDelete: "set null" }),
    role: text("role", { enum: LINK_ROLES }).notNull(),
    status: text("status", { enum: JOIN_REQUEST_STATUSES }).notNull().default("pending"),
    decidedBy: uuid("decided_by").references(() => userSchema.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { precision: 3, mode: "string", withTimezone: true }),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // One open request per person per group: using a link again returns it.
    uniqueIndex("care_group_join_request_pending_unique")
      .on(t.groupId, t.userId)
      .where(sql`${t.status} = 'pending'`),
    index("care_group_join_request_user_idx").on(t.userId),
    enumCheck("care_group_join_request_role_check", t.role, LINK_ROLES),
    enumCheck("care_group_join_request_status_check", t.status, JOIN_REQUEST_STATUSES),
  ],
);

export type CareGroupJoinRequestSchema = typeof careGroupJoinRequestSchema;
export type CareGroupJoinRequestSelect = InferSelectModel<CareGroupJoinRequestSchema>;
export type CareGroupJoinRequestInsert = Omit<InferInsertModel<CareGroupJoinRequestSchema>, ProtectedField>;
export type CareGroupJoinRequest = CareGroupJoinRequestSelect;

export const careGroupJoinRequestSelectZSchema = createSelectSchema(careGroupJoinRequestSchema);
