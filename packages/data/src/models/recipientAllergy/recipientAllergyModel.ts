import type { RecipientAllergy } from "../../db";
import type { QuerySelectArgs } from "../base/queryHelpers";

import { softDeleteFunctions } from "../base/softDeleteModel";

export type { IncludeDeleted } from "../base/softDeleteModel";

export const schemaName = "recipientAllergySchema";
type K = typeof schemaName;

export const dbToModel = (row: RecipientAllergy) => row;

/** By substance. */
export const SUBSTANCE_ORDER = [
  { field: "substance", direction: "asc" },
  { field: "id", direction: "asc" },
] as const satisfies QuerySelectArgs<K>["orderBy"];

// Soft-deleted allergies are hidden unless a read asks for them, and can't be
// edited; `remove` sets `deletedAt`. Writes go through recipientAllergyService,
// which validates content.
export const { get, getById, list, create, update, remove } = softDeleteFunctions({
  schemaName,
  dbToModel,
  defaultOrder: SUBSTANCE_ORDER,
});
