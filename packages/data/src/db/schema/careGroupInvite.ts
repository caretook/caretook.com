import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "./columns";

import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { GROUP_ROLE_NAMES } from "../../constants/roles";
import { careGroupSchema } from "./careGroup";
import { audits, enumCheck, id, timestamps } from "./columns";
import { INVITE_KINDS } from "./inviteRules";
import { userSchema } from "./user";

export const INVITE_STATUSES = ["pending", "accepted", "declined", "revoked"] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

// An invitation to join a care group with a given role. The raw token is
// shown once (in the invite link); only its SHA-256 hash is stored. The
// inviter is `createdBy`. Expiry is checked on accept, so an expired invite
// can still read as "pending" (`inviteState` in inviteRules.ts says which).
//
// `kind` is `email` (sent to one address, which must match the account that
// accepts it) or `link` (shared by hand; invites slice 4). An email invite
// records who confirmed the care recipient agreed to share with this person
// (`consent_attested_by`/`_at`, with the consent version they saw).
export const careGroupInviteSchema = pgTable(
  "care_group_invite",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: INVITE_KINDS }).notNull().default("email"),
    // Required for email invites, null for links.
    email: text("email"),
    role: text("role", { enum: GROUP_ROLE_NAMES }).notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    // Links only: the raw token, encrypted with INVITE_LINK_KEY (AES-GCM), so
    // owners and admins can copy an active link again. Email invites keep
    // only the hash. Never leaves the model layer.
    tokenCiphertext: text("token_ciphertext"),
    status: text("status", { enum: INVITE_STATUSES }).notNull().default("pending"),
    expiresAt: timestamp("expires_at", { precision: 3, mode: "string", withTimezone: true }).notNull(),
    acceptedBy: uuid("accepted_by").references(() => userSchema.id, { onDelete: "set null" }),
    respondedAt: timestamp("responded_at", { precision: 3, mode: "string", withTimezone: true }),
    // A link's limit (null: no limit) and how many people have used it.
    maxUses: integer("max_uses"),
    useCount: integer("use_count").notNull().default(0),
    consentAttestedBy: uuid("consent_attested_by").references(() => userSchema.id, { onDelete: "set null" }),
    consentAttestedAt: timestamp("consent_attested_at", { precision: 3, mode: "string", withTimezone: true }),
    consentVersion: text("consent_version"),
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
    enumCheck("care_group_invite_kind_check", t.kind, INVITE_KINDS),
    // An email invite names its address and records the inviter's attestation.
    // A link never makes an owner or admin.
    check(
      "care_group_invite_link_role_check",
      sql`${t.kind} <> 'link' OR ${t.role} IN ('caretaker', 'viewer')`,
    ),
    check(
      "care_group_invite_email_check",
      sql`${t.kind} <> 'email' OR (${t.email} IS NOT NULL AND ${t.consentAttestedAt} IS NOT NULL)`,
    ),
  ],
);

export type CareGroupInviteSchema = typeof careGroupInviteSchema;
export type CareGroupInviteSelect = InferSelectModel<CareGroupInviteSchema>;
export type CareGroupInviteInsert = Omit<InferInsertModel<CareGroupInviteSchema>, ProtectedField>;
export type CareGroupInviteUpdate = Partial<CareGroupInviteInsert>;
export type CareGroupInvite = CareGroupInviteSelect;

export const careGroupInviteSelectZSchema = createSelectSchema(careGroupInviteSchema).omit({
  tokenHash: true,
  tokenCiphertext: true,
});
export const careGroupInviteInsertZSchema = createInsertSchema(careGroupInviteSchema, { email: z.email() });
export const careGroupInviteUpdateZSchema = createUpdateSchema(careGroupInviteSchema, { email: z.email() });
