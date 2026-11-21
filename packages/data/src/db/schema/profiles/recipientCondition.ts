import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";

import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { careGroupSchema } from "../care-groups/careGroup";
import { providerSchema } from "../providers/provider";
import { careRecipientSchema } from "./careRecipient";
import { audits, enumCheck, id, timestamps } from "../core/columns";

// The care recipient's conditions (conditions PRD): the diagnoses behind the
// medications, active or resolved, with a rough "since" (a year, or a month
// and year) and a short note. A list like recipient_allergy: `group_id` on
// the row, ids made on the device, soft deletes. "No known conditions" is
// `care_recipient.no_known_conditions_at`.

export const CONDITION_STATUSES = ["active", "resolved"] as const;
export type ConditionStatus = (typeof CONDITION_STATUSES)[number];

export const CONDITION_LIMITS = { name: 200, note: 300 } as const;

/** The years a "since" may name (the database checks the same range). */
export const CONDITION_SINCE_YEARS = { min: 1900, max: 2100 } as const;

const timestampColumn = (name: string) =>
  timestamp(name, { precision: 3, mode: "string", withTimezone: true });

export const recipientConditionSchema = pgTable(
  "recipient_condition",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id").notNull(),
    // "Type 2 diabetes", "High blood pressure", "Atrial fibrillation".
    name: text("name").notNull(),
    status: text("status", { enum: CONDITION_STATUSES }).notNull().default("active"),
    // Roughly since when: a year, or a month (1-12) and a year.
    sinceYear: integer("since_year"),
    sinceMonth: integer("since_month"),
    // "Diet-controlled".
    note: text("note"),
    // Who diagnosed it: a provider in the same group (NO ACTION, like
    // medication.prescriber_id: providers are only soft-deleted).
    diagnosedById: uuid("diagnosed_by_id"),
    deletedAt: timestampColumn("deleted_at"),
    ...timestamps,
    ...audits,
  },
  (t) => [
    unique("recipient_condition_group_id_id_unique").on(t.groupId, t.id),
    // The recipient must belong to the condition's group (NO ACTION, like recipient_allergy).
    foreignKey({
      name: "recipient_condition_recipient_fk",
      columns: [t.groupId, t.recipientId],
      foreignColumns: [careRecipientSchema.groupId, careRecipientSchema.id],
    }),
    foreignKey({
      name: "recipient_condition_diagnosed_by_fk",
      columns: [t.groupId, t.diagnosedById],
      foreignColumns: [providerSchema.groupId, providerSchema.id],
    }),
    index("recipient_condition_group_idx").on(t.groupId),
    enumCheck("recipient_condition_status_check", t.status, CONDITION_STATUSES),
    check(
      "recipient_condition_since_year_check",
      sql`${t.sinceYear} IS NULL OR ${t.sinceYear} BETWEEN ${sql.raw(String(CONDITION_SINCE_YEARS.min))} AND ${sql.raw(String(CONDITION_SINCE_YEARS.max))}`,
    ),
    check(
      "recipient_condition_since_month_check",
      sql`${t.sinceMonth} IS NULL OR (${t.sinceYear} IS NOT NULL AND ${t.sinceMonth} BETWEEN 1 AND 12)`,
    ),
  ],
);

export type RecipientConditionSchema = typeof recipientConditionSchema;
export type RecipientConditionSelect = InferSelectModel<RecipientConditionSchema>;
export type RecipientConditionInsert = Omit<InferInsertModel<RecipientConditionSchema>, ProtectedField>;
export type RecipientConditionUpdate = Partial<RecipientConditionInsert>;
export type RecipientCondition = RecipientConditionSelect;

// ---------------------------------------------------------------------------
// Zod schemas (client-safe)
// ---------------------------------------------------------------------------

/** Optional text: trimmed, and empty means none (null). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `At most ${max} characters` })
    .nullish()
    .transform((v) => (v ? v : null));

const sinceYear = z
  .int({ error: "Enter a year, such as 2015" })
  .min(CONDITION_SINCE_YEARS.min, { error: `Enter a year from ${CONDITION_SINCE_YEARS.min}` })
  .max(CONDITION_SINCE_YEARS.max, { error: `Enter a year up to ${CONDITION_SINCE_YEARS.max}` })
  .nullish()
  .transform((v) => v ?? null);
const sinceMonth = z
  .int({ error: "Choose a month" })
  .min(1, { error: "Choose a month" })
  .max(12, { error: "Choose a month" })
  .nullish()
  .transform((v) => v ?? null);

const conditionFields = {
  name: z.string().trim().min(1, { error: "Enter the condition" }).max(CONDITION_LIMITS.name),
  status: z.enum(CONDITION_STATUSES).default("active"),
  sinceYear,
  sinceMonth,
  note: optionalText(CONDITION_LIMITS.note),
  // Who diagnosed it: a live provider in the group (the service checks it
  // when it's set or changed; one deleted later stays, greyed).
  diagnosedById: z
    .uuid({ error: "Choose a provider in this care group" })
    .nullish()
    .transform((v) => v ?? null),
};

/** A month needs a year ("March" alone isn't a since). */
const sinceNeedsYear = (v: { sinceYear: number | null; sinceMonth: number | null }, ctx: z.RefinementCtx) => {
  if (v.sinceMonth !== null && v.sinceYear === null)
    ctx.addIssue({ code: "custom", path: ["sinceYear"], message: "Enter the year too" });
};

/** A condition's content: on create, and on update against the merged row. */
export const recipientConditionContentZSchema = z.object(conditionFields).superRefine(sinceNeedsYear);
export type RecipientConditionContent = z.output<typeof recipientConditionContentZSchema>;
export type RecipientConditionContentInput = z.input<typeof recipientConditionContentZSchema>;

const createFields = {
  id: z.uuid().optional(),
  groupId: z.uuid(),
  recipientId: z.uuid().optional(),
  ...conditionFields,
};

/** Create input. `id` may come from an offline device; `recipientId` defaults to the group's recipient. */
export const recipientConditionCreateZSchema = z.object(createFields).superRefine(sinceNeedsYear);
export type RecipientConditionCreateInput = z.input<typeof recipientConditionCreateZSchema>;

/** Upsert input (PowerSync's upload queue): a create whose `id` is required. */
export const recipientConditionUpsertZSchema = z
  .object({ ...createFields, id: z.uuid() })
  .superRefine(sinceNeedsYear);
export type RecipientConditionUpsertInput = z.input<typeof recipientConditionUpsertZSchema>;

/**
 * Update input: content only, each optional (left out keeps its value; null
 * or empty clears an optional one). The group and recipient never change.
 * The merged condition is checked with the content schema.
 */
export const recipientConditionUpdateZSchema = z.strictObject({
  name: conditionFields.name.optional(),
  status: z.enum(CONDITION_STATUSES).optional(),
  sinceYear: z.int().nullish(),
  sinceMonth: z.int().nullish(),
  note: z.string().nullish(),
  diagnosedById: z.uuid({ error: "Choose a provider in this care group" }).nullish(),
});
export type RecipientConditionUpdateInput = z.input<typeof recipientConditionUpdateZSchema>;
