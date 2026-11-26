import type { Tag } from "../../db";
import type { QuerySelectArgs } from "../base/queryHelpers";

import * as baseModel from "../base";

export const schemaName = "tagSchema";
type K = typeof schemaName;

export const dbToModel = (row: Tag) => row;

const base = baseModel.getFunctions({ schemaName, dbToModel });

/** By name, A to Z. */
export const NAME_ORDER = [
  { field: "nameKey", direction: "asc" },
  { field: "id", direction: "asc" },
] as const satisfies QuerySelectArgs<K>["orderBy"];

export const { get, getById } = base;

export const list = (args: QuerySelectArgs<K>) =>
  base.list({ ...args, orderBy: args.orderBy ?? [...NAME_ORDER] });

// Write through tagService, which derives the id and the key.
export const { create, update, remove } = base;
