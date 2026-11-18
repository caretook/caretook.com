import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "./columns";

import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { careGroupSchema } from "./careGroup";
import { careGroupInviteSchema } from "./careGroupInvite";
import { audits, enumCheck, id, timestamps } from "./columns";
import { userSchema } from "./user";

export const CONSENT_KINDS = ["joiner"] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

// A record that someone agreed to what a care group shares before joining
// it: who, which group, when (`created_at`), and the version of the words
// they saw (CONSENT_TEXT in inviteRules.ts). Append-only and written by the
// system, when an invite is accepted. The inviter's own attestation lives on
// the invite. Nothing here syncs to devices: it's read through the API.
export const careGroupConsentSchema = pgTable(
  "care_group_consent",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => userSchema.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: CONSENT_KINDS }).notNull().default("joiner"),
    consentVersion: text("consent_version").notNull(),
    inviteId: uuid("invite_id").references(() => careGroupInviteSchema.id, { onDelete: "set null" }),
    ...timestamps,
    ...audits,
  },
  (t) => [
    index("care_group_consent_group_idx").on(t.groupId),
    index("care_group_consent_user_idx").on(t.userId),
    enumCheck("care_group_consent_kind_check", t.kind, CONSENT_KINDS),
  ],
);

export type CareGroupConsentSchema = typeof careGroupConsentSchema;
export type CareGroupConsentSelect = InferSelectModel<CareGroupConsentSchema>;
export type CareGroupConsentInsert = Omit<InferInsertModel<CareGroupConsentSchema>, ProtectedField>;
export type CareGroupConsent = CareGroupConsentSelect;

export const careGroupConsentSelectZSchema = createSelectSchema(careGroupConsentSchema);
