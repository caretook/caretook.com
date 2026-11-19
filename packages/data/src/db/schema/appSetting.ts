import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Settings staff change without a deploy (admin PRD): sign-up switches, the
// announcement banner, the email allowlist and a few limits. One row per key
// that has been changed; a key without a row has its default. Keys, their
// value schemas and defaults live in the typed APP_SETTINGS registry, and
// everything reads and writes through getSetting/setSetting (never this
// table directly). Staff read, only the system writes (after the capability
// check, with an audit entry); nothing deletes.
export const appSettingSchema = pgTable("app_setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { precision: 3, mode: "string", withTimezone: true })
    .defaultNow()
    .notNull(),
  // Who changed it last (a staff member's id, or null for the system). No FK, as with audits.
  updatedBy: uuid("updated_by"),
});

export type AppSettingSchema = typeof appSettingSchema;
export type AppSetting = InferSelectModel<AppSettingSchema>;
export type AppSettingInsert = InferInsertModel<AppSettingSchema>;
