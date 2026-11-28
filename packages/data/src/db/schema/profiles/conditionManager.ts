import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";

import { foreignKey, index, pgTable, unique, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { audits, timestamps } from "../core/columns";
import { uuidV5 } from "../../../domain/core/uuidV5";
import { providerSchema } from "../providers/provider";
import { recipientConditionSchema } from "./recipientCondition";

// Who manages a condition (conditions slice 3): one row per (condition,
// provider). The cardiologist for atrial fibrillation; the primary care
// doctor and an endocrinologist for diabetes. Who diagnosed it is the
// condition's own `diagnosed_by_id`.
//
// The id is derived from the pair (`conditionManagerId`), like
// `medication_condition`'s, so two devices linking the same pair offline
// write the same row and replays land on it. Unlinking deletes the row. A
// deleted (soft) provider's links stay, and screens grey it "(removed)".

/** The namespace for link ids (a fixed, random UUID; never change it). */
export const CONDITION_MANAGER_NAMESPACE = "8a2e4c71-5b9d-4f06-a3c8-1e7d9b4f2a65";

/** A link's id: the version 5 UUID of its condition and provider ids. Case-insensitive in its inputs. */
export const conditionManagerId = (conditionId: string, providerId: string) =>
  uuidV5(`${conditionId.toLowerCase()}:${providerId.toLowerCase()}`, CONDITION_MANAGER_NAMESPACE);

export const conditionManagerSchema = pgTable(
  "condition_manager",
  {
    // Always given: conditionManagerId(conditionId, providerId).
    id: uuid("id").primaryKey(),
    groupId: uuid("group_id").notNull(),
    conditionId: uuid("condition_id").notNull(),
    providerId: uuid("provider_id").notNull(),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // Both ends must be in the link's group; a hard delete of either removes the link.
    foreignKey({
      name: "condition_manager_condition_fk",
      columns: [t.groupId, t.conditionId],
      foreignColumns: [recipientConditionSchema.groupId, recipientConditionSchema.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "condition_manager_provider_fk",
      columns: [t.groupId, t.providerId],
      foreignColumns: [providerSchema.groupId, providerSchema.id],
    }).onDelete("cascade"),
    unique("condition_manager_condition_provider_unique").on(t.conditionId, t.providerId),
    index("condition_manager_group_idx").on(t.groupId),
    // A provider's conditions (the provider page).
    index("condition_manager_provider_idx").on(t.providerId),
  ],
);

export type ConditionManagerSchema = typeof conditionManagerSchema;
export type ConditionManagerSelect = InferSelectModel<ConditionManagerSchema>;
export type ConditionManagerInsert = Omit<InferInsertModel<ConditionManagerSchema>, ProtectedField>;
export type ConditionManager = ConditionManagerSelect;

/**
 * Say a provider manages a condition. `id`, when given (a device's upload),
 * must be the pair's derived id.
 */
export const conditionManagerLinkZSchema = z
  .strictObject({
    id: z.uuid().optional(),
    groupId: z.uuid(),
    conditionId: z.uuid(),
    providerId: z.uuid(),
  })
  .refine((v) => !v.id || v.id.toLowerCase() === conditionManagerId(v.conditionId, v.providerId), {
    path: ["id"],
    error: "A link's id comes from its condition and provider",
  });
export type ConditionManagerLinkInput = z.input<typeof conditionManagerLinkZSchema>;
