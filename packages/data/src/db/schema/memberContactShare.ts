import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { ProtectedField } from "./columns";
import type { ContactPhone } from "./contactFields";

import { foreignKey, jsonb, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { careGroupMemberSchema } from "./careGroupMember";
import { audits, id, timestamps } from "./columns";
import { CONTACT_LIMITS, optionalTextZSchema } from "./contactFields";

// What one member shares with one care group (profiles): only the values of
// the fields they chose, null for the rest. A projection of `user_contact`
// and the membership's `shared_fields`, written only by the services, in the
// same transaction as any change to either; deleted with the membership (the
// cascading FK), so leaving really leaves. Its id is the membership's id.
//
// It syncs to every member of the group, so the streams never touch
// `user_contact` or co-members' `user` rows for contact details.

/** The contact fields a member can share with a group. */
export const SHARED_FIELDS = ["phones", "email", "address"] as const;
export type SharedField = (typeof SHARED_FIELDS)[number];

export const memberContactShareSchema = pgTable(
  "member_contact_share",
  {
    id: id(),
    groupId: uuid("group_id").notNull(),
    userId: uuid("user_id").notNull(),
    // Null when not shared (or nothing entered).
    phones: jsonb("phones").$type<ContactPhone[]>(),
    email: text("email"),
    address: text("address"),
    ...timestamps,
    ...audits,
  },
  (t) => [
    unique("member_contact_share_group_user_unique").on(t.groupId, t.userId),
    foreignKey({
      name: "member_contact_share_member_fk",
      columns: [t.groupId, t.userId],
      foreignColumns: [careGroupMemberSchema.groupId, careGroupMemberSchema.userId] as [
        AnyPgColumn,
        AnyPgColumn,
      ],
    }).onDelete("cascade"),
  ],
);

export type MemberContactShareSchema = typeof memberContactShareSchema;
export type MemberContactShareSelect = InferSelectModel<MemberContactShareSchema>;
export type MemberContactShareInsert = Omit<InferInsertModel<MemberContactShareSchema>, ProtectedField>;
export type MemberContactShare = MemberContactShareSelect;

/** A member's choices for one group: what it sees, and how they're related to the recipient. */
export const memberSharingZSchema = z.strictObject({
  sharedFields: z
    .array(z.enum(SHARED_FIELDS))
    .max(SHARED_FIELDS.length)
    .transform((fields) => SHARED_FIELDS.filter((f) => fields.includes(f)))
    .optional(),
  relationship: optionalTextZSchema(CONTACT_LIMITS.relationship).optional(),
});
export type MemberSharingInput = z.input<typeof memberSharingZSchema>;
