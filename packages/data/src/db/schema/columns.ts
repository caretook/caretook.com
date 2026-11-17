import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";
import { check, timestamp, uuid } from "drizzle-orm/pg-core";

// Every table uses a UUID primary key. PowerSync clients create rows offline,
// so ids must be generatable on the client; the default covers server inserts.
export const id = () => uuid("id").primaryKey().defaultRandom();

const timestampColumn = (name: string) =>
  timestamp(name, { precision: 3, mode: "string", withTimezone: true });

export const timestamps = {
  createdAt: timestampColumn("created_at").defaultNow().notNull(),
  updatedAt: timestampColumn("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
};

// Who created / last changed the row. Set by the model layer, never by callers.
// No FK: the system actor (SYSTEM_USER) isn't a real user row.
export const audits = {
  createdBy: uuid("created_by").notNull(),
  updatedBy: uuid("updated_by").notNull(),
};

export const AUDIT_FIELDS = ["createdBy", "updatedBy"] as const;
export type AuditField = (typeof AUDIT_FIELDS)[number];

// Fields callers may never write directly.
export const PROTECTED_FIELDS = [...AUDIT_FIELDS, "createdAt", "updatedAt"] as const;
export type ProtectedField = (typeof PROTECTED_FIELDS)[number];

/**
 * A CHECK constraint limiting a text column to `values`. `text({ enum })`
 * only narrows the TS type; this enforces it in the database.
 */
export const enumCheck = (name: string, column: AnyPgColumn, values: readonly string[]) =>
  check(name, sql`${column} IN (${sql.raw(values.map((v) => `'${v}'`).join(", "))})`);
