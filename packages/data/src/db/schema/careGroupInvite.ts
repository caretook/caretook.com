import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "./columns";

import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { GROUP_ROLE_NAMES } from "../../constants/roles";
import { careGroupSchema } from "./careGroup";
import { audits, enumCheck, id, timestamps } from "./columns";
import { userSchema } from "./user";

export const INVITE_STATUSES = ["pending", "accepted", "declined", "revoked"] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

// An invitation to join a care group with a given role. The raw token is
// shown once (in the invite link); only its SHA-256 hash is stored. The
// inviter is `createdBy`. Expiry is checked on accept, so an expired invite
// can still read as "pending".
export const careGroupInviteSchema = pgTable(
  "care_group_invite",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role", { enum: GROUP_ROLE_NAMES }).notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    status: text("status", { enum: INVITE_STATUSES }).notNull().default("pending"),
    expiresAt: timestamp("expires_at", { precision: 3, mode: "string", withTimezone: true }).notNull(),
    acceptedBy: uuid("accepted_by").references(() => userSchema.id, { onDelete: "set null" }),
    respondedAt: timestamp("responded_at", { precision: 3, mode: "string", withTimezone: true }),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // One open invite per email per group.
    uniqueIndex("care_group_invite_pending_unique")
      .on(t.groupId, t.email)
      .where(sql`${t.status} = 'pending'`),
    index("care_group_invite_email_idx").on(t.email),
    enumCheck("care_group_invite_role_check", t.role, GROUP_ROLE_NAMES),
    enumCheck("care_group_invite_status_check", t.status, INVITE_STATUSES),
  ],
);

export type CareGroupInviteSchema = typeof careGroupInviteSchema;
export type CareGroupInviteSelect = InferSelectModel<CareGroupInviteSchema>;
export type CareGroupInviteInsert = Omit<InferInsertModel<CareGroupInviteSchema>, ProtectedField>;
export type CareGroupInviteUpdate = Partial<CareGroupInviteInsert>;
export type CareGroupInvite = CareGroupInviteSelect;

export const careGroupInviteSelectZSchema = createSelectSchema(careGroupInviteSchema).omit({
  tokenHash: true,
});
export const careGroupInviteInsertZSchema = createInsertSchema(careGroupInviteSchema, { email: z.email() });
export const careGroupInviteUpdateZSchema = createUpdateSchema(careGroupInviteSchema, { email: z.email() });
