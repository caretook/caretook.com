import type { CarePeriod } from "../../db";
import type { QuerySelectArgs } from "../base/queryHelpers";

import { softDeleteFunctions } from "../base/softDeleteModel";

export type { IncludeDeleted } from "../base/softDeleteModel";

export const schemaName = "carePeriodSchema";
type K = typeof schemaName;

export const dbToModel = (row: CarePeriod) => row;

/** The track's order: start, then when it was created, then id (see carePeriodTrack.ts). */
export const TRACK_ORDER = [
  { field: "startedAt", direction: "asc" },
  { field: "createdAt", direction: "asc" },
  { field: "id", direction: "asc" },
] as const satisfies QuerySelectArgs<K>["orderBy"];

// Soft-deleted periods are hidden unless a read asks for them, and can't be
// edited; `remove` sets `deletedAt`, and the period before a deleted one then
// runs on (see carePeriodTrack.ts). Writes go through carePeriodService, which
// validates content and checks the place and the start.
export const { get, getById, list, create, update, remove } = softDeleteFunctions({
  schemaName,
  dbToModel,
  defaultOrder: TRACK_ORDER,
});
