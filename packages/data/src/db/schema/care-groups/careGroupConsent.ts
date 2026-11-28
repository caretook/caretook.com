import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";

import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { careGroupInviteSchema } from "./careGroupInvite";
import { audits, enumCheck, id, timestamps } from "../core/columns";

export const CONSENT_KINDS = ["joiner"] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

// A record that someone agreed to what a care group shares before joining
// it: who, which group, when (`created_at`), and the version of the words
// they saw (CONSENT_TEXT in inviteRules.ts). Append-only and written by the
// system, when an invite is used (careGroupInviteService.accept for an email
// invite, joinRequestService.requestWithLink for a link). It also keeps the
// inviter's attestation, copied from the invite (`consent_attested_by`/`_at`
// and the version they attested to, `consent_attested_version`): an email
// invite always carries one, a link may carry none (then they stay null).
// Evidence outlives what it's about (data-rights PRD): `group_id`, `user_id`
// and `consent_attested_by` are bare ids, with no foreign key, so deleting
// the group or an account keeps the row. Nothing here syncs to devices: it's
// read through the API.
export const careGroupConsentSchema = pgTable(
  "care_group_consent",
  {
    id: id(),
    groupId: uuid("group_id").notNull(),
    userId: uuid("user_id").notNull(),
    kind: text("kind", { enum: CONSENT_KINDS }).notNull().default("joiner"),
    consentVersion: text("consent_version").notNull(),
    consentAttestedBy: uuid("consent_attested_by"),
    consentAttestedAt: timestamp("consent_attested_at", { precision: 3, mode: "string", withTimezone: true }),
    consentAttestedVersion: text("consent_attested_version"),
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

export const careGroupConsentSelectZSchema = /* @__PURE__ */ createSelectSchema(careGroupConsentSchema);
