import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "./columns";

import { foreignKey, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { careGroupSchema } from "./careGroup";
import { careRecipientSchema } from "./careRecipient";
import { audits, enumCheck, id, timestamps } from "./columns";

// The care recipient's allergies: what they're allergic to, what it does and
// how bad it is. A list (not columns on care_recipient), synced like the
// medication list: `group_id` on the row, ids made on the device, soft
// deletes. "No known allergies" is `care_recipient.no_known_allergies_at`.

export const ALLERGY_SEVERITIES = ["mild", "moderate", "severe", "unknown"] as const;
export type AllergySeverity = (typeof ALLERGY_SEVERITIES)[number];

const timestampColumn = (name: string) =>
  timestamp(name, { precision: 3, mode: "string", withTimezone: true });

export const recipientAllergySchema = pgTable(
  "recipient_allergy",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id").notNull(),
    // "Penicillin", "Sulfa drugs", "Peanuts".
    substance: text("substance").notNull(),
    // What happens: "Hives", "Swelling of the lips".
    reaction: text("reaction"),
    severity: text("severity", { enum: ALLERGY_SEVERITIES }).notNull().default("unknown"),
    deletedAt: timestampColumn("deleted_at"),
    ...timestamps,
    ...audits,
  },
  (t) => [
    unique("recipient_allergy_group_id_id_unique").on(t.groupId, t.id),
    // The recipient must belong to the allergy's group (NO ACTION, like medication).
    foreignKey({
      name: "recipient_allergy_recipient_fk",
      columns: [t.groupId, t.recipientId],
      foreignColumns: [careRecipientSchema.groupId, careRecipientSchema.id],
    }),
    index("recipient_allergy_group_idx").on(t.groupId),
    enumCheck("recipient_allergy_severity_check", t.severity, ALLERGY_SEVERITIES),
  ],
);

export type RecipientAllergySchema = typeof recipientAllergySchema;
export type RecipientAllergySelect = InferSelectModel<RecipientAllergySchema>;
export type RecipientAllergyInsert = Omit<InferInsertModel<RecipientAllergySchema>, ProtectedField>;
export type RecipientAllergyUpdate = Partial<RecipientAllergyInsert>;
export type RecipientAllergy = RecipientAllergySelect;

// ---------------------------------------------------------------------------
// Zod schemas (client-safe)
// ---------------------------------------------------------------------------

export const ALLERGY_LIMITS = { substance: 200, reaction: 300 } as const;

const allergyFields = {
  substance: z
    .string()
    .trim()
    .min(1, { error: "Enter what they're allergic to" })
    .max(ALLERGY_LIMITS.substance),
  reaction: z
    .string()
    .trim()
    .max(ALLERGY_LIMITS.reaction)
    .nullish()
    .transform((v) => (v ? v : null)),
  severity: z.enum(ALLERGY_SEVERITIES).default("unknown"),
};

/** An allergy's content: on create, and on update against the merged row. */
export const recipientAllergyContentZSchema = z.object(allergyFields);
export type RecipientAllergyContent = z.output<typeof recipientAllergyContentZSchema>;
export type RecipientAllergyContentInput = z.input<typeof recipientAllergyContentZSchema>;

/** Create input. `id` may come from an offline device; `recipientId` defaults to the group's recipient. */
export const recipientAllergyCreateZSchema = z.object({
  id: z.uuid().optional(),
  groupId: z.uuid(),
  recipientId: z.uuid().optional(),
  ...allergyFields,
});
export type RecipientAllergyCreateInput = z.input<typeof recipientAllergyCreateZSchema>;

/** Upsert input (PowerSync's upload queue): a create whose `id` is required. */
export const recipientAllergyUpsertZSchema = recipientAllergyCreateZSchema.extend({ id: z.uuid() });
export type RecipientAllergyUpsertInput = z.input<typeof recipientAllergyUpsertZSchema>;

/** Update input: content only. The group and recipient never change. */
export const recipientAllergyUpdateZSchema = z.strictObject({
  substance: allergyFields.substance.optional(),
  reaction: z.string().nullish(),
  severity: z.enum(ALLERGY_SEVERITIES).optional(),
});
export type RecipientAllergyUpdateInput = z.input<typeof recipientAllergyUpdateZSchema>;
