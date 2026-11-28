import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";

import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { audits, enumCheck, id, timestamps } from "../core/columns";

export const LEGAL_ACCEPTANCE_SOURCES = ["access_code", "invite_signup", "invite_accept"] as const;
export type LegalAcceptanceSource = (typeof LEGAL_ACCEPTANCE_SOURCES)[number];

// A record that someone confirmed they're 18 or older and agreed to the
// Terms, the Privacy Policy and the Consumer Health Data Privacy Policy: who,
// when (`created_at`), which versions, which words and where. One row per
// acceptance, append-only, written by the system through
// legalAcceptanceService. No IP address or user agent. Evidence outlives the
// account (data-rights PRD): `user_id` is a bare id, with no foreign key, so
// deleting the account keeps its rows. Nothing here syncs to devices.
export const legalAcceptanceSchema = pgTable(
  "legal_acceptance",
  {
    id: id(),
    userId: uuid("user_id").notNull(),
    termsVersion: text("terms_version").notNull(),
    privacyVersion: text("privacy_version").notNull(),
    healthDataPrivacyVersion: text("health_data_privacy_version").notNull(),
    wordingVersion: text("wording_version").notNull(),
    source: text("source", { enum: LEGAL_ACCEPTANCE_SOURCES }).notNull(),
    ...timestamps,
    ...audits,
  },
  (t) => [
    index("legal_acceptance_user_idx").on(t.userId),
    enumCheck("legal_acceptance_source_check", t.source, LEGAL_ACCEPTANCE_SOURCES),
  ],
);

export type LegalAcceptanceSchema = typeof legalAcceptanceSchema;
export type LegalAcceptanceSelect = InferSelectModel<LegalAcceptanceSchema>;
export type LegalAcceptanceInsert = Omit<InferInsertModel<LegalAcceptanceSchema>, ProtectedField>;
export type LegalAcceptance = LegalAcceptanceSelect;
