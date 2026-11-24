import type { SymptomType } from "../../db";
import type { QuerySelectArgs } from "../base/queryHelpers";

import * as baseModel from "../base";

export const schemaName = "symptomTypeSchema";
type K = typeof schemaName;

export const dbToModel = (row: SymptomType) => row;

const base = baseModel.getFunctions({ schemaName, dbToModel });

/** By name, A to Z. */
export const NAME_ORDER = [
  { field: "nameKey", direction: "asc" },
  { field: "id", direction: "asc" },
] as const satisfies QuerySelectArgs<K>["orderBy"];

export const { get, getById } = base;

export const list = (args: QuerySelectArgs<K>) =>
  base.list({ ...args, orderBy: args.orderBy ?? [...NAME_ORDER] });

// Catalog rows are added, never changed or removed (but with their group).
// Write through symptomTypeService, which derives the id and the key.
export const { create } = base;
