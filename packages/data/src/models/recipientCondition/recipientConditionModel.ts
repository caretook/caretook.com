import type { RecipientCondition } from "../../db";
import type { QuerySelectArgs } from "../base/queryHelpers";

import { softDeleteFunctions } from "../base/softDeleteModel";

export type { IncludeDeleted } from "../base/softDeleteModel";

export const schemaName = "recipientConditionSchema";
type K = typeof schemaName;

export const dbToModel = (row: RecipientCondition) => row;

/** By name (screens order by status and since: `lib/profiles/conditions.ts`). */
export const NAME_ORDER = [
  { field: "name", direction: "asc" },
  { field: "id", direction: "asc" },
] as const satisfies QuerySelectArgs<K>["orderBy"];

// Soft-deleted conditions are hidden unless a read asks for them, and can't be
// edited; `remove` sets `deletedAt`. Writes go through recipientConditionService,
// which validates content.
export const { get, getById, list, create, update, remove } = softDeleteFunctions({
  schemaName,
  dbToModel,
  defaultOrder: NAME_ORDER,
});
