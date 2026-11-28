import type { Medication } from "../../db";
import type { QuerySelectArgs } from "../base/queryHelpers";

import { softDeleteFunctions } from "../base/softDeleteModel";

export type { IncludeDeleted } from "../base/softDeleteModel";

export const schemaName = "medicationSchema";
type K = typeof schemaName;

export const dbToModel = (row: Medication) => row;

/** By name. `medicationService.list` puts current ones first. */
export const NAME_ORDER = [
  { field: "name", direction: "asc" },
  { field: "id", direction: "asc" },
] as const satisfies QuerySelectArgs<K>["orderBy"];

// Soft-deleted medications are hidden unless a read asks for them, and can't be
// edited; `remove` sets `deletedAt`, so the doses and changes already on the
// timeline can still show the medication's name. Writes go through
// medicationService, which validates content, checks the prescriber and
// pharmacy, and writes the timeline's change entry.
export const { get, getById, list, create, update, remove } = softDeleteFunctions({
  schemaName,
  dbToModel,
  defaultOrder: NAME_ORDER,
});
