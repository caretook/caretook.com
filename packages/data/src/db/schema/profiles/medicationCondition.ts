import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";

import { foreignKey, index, pgTable, unique, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { audits, timestamps } from "../core/columns";
import { uuidV5 } from "../core/uuidV5";
import { medicationSchema } from "../medications/medication";
import { recipientConditionSchema } from "./recipientCondition";

// What a medication is for (conditions PRD): one row per (medication,
// condition). Metformin for Type 2 diabetes; a blood thinner for atrial
// fibrillation. The medication's free-text `reason` stays beside it.
//
// The id is derived from the pair (`medicationConditionId`), like
// `timeline_entry_provider`'s, so two devices linking the same pair offline
// write the same row and replays land on it. Unlinking deletes the row. A
// deleted (soft) condition's links stay, and every list hides them.

/** The namespace for link ids (a fixed, random UUID; never change it). */
export const MEDICATION_CONDITION_NAMESPACE = "3d6b8f1e-2c47-4a9d-b5e0-8f7a1c2d9e43";

/** A link's id: the version 5 UUID of its medication and condition ids. Case-insensitive in its inputs. */
export const medicationConditionId = (medicationId: string, conditionId: string) =>
  uuidV5(`${medicationId.toLowerCase()}:${conditionId.toLowerCase()}`, MEDICATION_CONDITION_NAMESPACE);

export const medicationConditionSchema = pgTable(
  "medication_condition",
  {
    // Always given: medicationConditionId(medicationId, conditionId).
    id: uuid("id").primaryKey(),
    groupId: uuid("group_id").notNull(),
    medicationId: uuid("medication_id").notNull(),
    conditionId: uuid("condition_id").notNull(),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // Both ends must be in the link's group; a hard delete of either removes the link.
    foreignKey({
      name: "medication_condition_medication_fk",
      columns: [t.groupId, t.medicationId],
      foreignColumns: [medicationSchema.groupId, medicationSchema.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "medication_condition_condition_fk",
      columns: [t.groupId, t.conditionId],
      foreignColumns: [recipientConditionSchema.groupId, recipientConditionSchema.id],
    }).onDelete("cascade"),
    unique("medication_condition_medication_condition_unique").on(t.medicationId, t.conditionId),
    index("medication_condition_group_idx").on(t.groupId),
    // A condition's medications.
    index("medication_condition_condition_idx").on(t.conditionId),
  ],
);

export type MedicationConditionSchema = typeof medicationConditionSchema;
export type MedicationConditionSelect = InferSelectModel<MedicationConditionSchema>;
export type MedicationConditionInsert = Omit<InferInsertModel<MedicationConditionSchema>, ProtectedField>;
export type MedicationCondition = MedicationConditionSelect;

/**
 * Link a medication to a condition. `id`, when given (a device's upload),
 * must be the pair's derived id.
 */
export const medicationConditionLinkZSchema = z
  .strictObject({
    id: z.uuid().optional(),
    groupId: z.uuid(),
    medicationId: z.uuid(),
    conditionId: z.uuid(),
  })
  .refine((v) => !v.id || v.id.toLowerCase() === medicationConditionId(v.medicationId, v.conditionId), {
    path: ["id"],
    error: "A link's id comes from its medication and condition",
  });
export type MedicationConditionLinkInput = z.input<typeof medicationConditionLinkZSchema>;
