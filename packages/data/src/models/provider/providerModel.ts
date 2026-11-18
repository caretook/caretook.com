import type { Provider } from "../../db";
import type { Filter, QuerySelectArgs } from "../base/queryHelpers";

import { sql } from "drizzle-orm";
import { SYSTEM_USER } from "../../constants";
import { dbMayFail, txOrDb } from "../../db";
import { providerSchema } from "../../db/schema";
import { isError, newError } from "../../errors";
import * as baseModel from "../base";
import { generateQueryWhere, isFilterEmpty } from "../base/queryHelpers";

export const schemaName = "providerSchema";
type K = typeof schemaName;

export const dbToModel = (row: Provider) => row;

const base = baseModel.getFunctions({ schemaName, dbToModel });

/** Soft-deleted providers are hidden unless a read asks for them. */
export type IncludeDeleted = { includeDeleted?: boolean };

const live = (filter: Filter<K> | undefined, opts: IncludeDeleted = {}): Filter<K> | undefined =>
  opts.includeDeleted ? filter : { ...filter, deletedAt: { type: "isNull" } };

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const get = (args: QuerySelectArgs<K> & IncludeDeleted) =>
  base.get({ ...args, filter: live(args.filter, args) });

export const getById = (id: string, args: Omit<QuerySelectArgs<K>, "filter"> & IncludeDeleted) =>
  get({ ...args, filter: { id: { type: "eq", value: id } } });

/** The display order: primary first, then current, then past, each by name. */
export const DISPLAY_ORDER = [
  { field: "isPrimary", direction: "desc" },
  { field: "status", direction: "asc" },
  { field: "name", direction: "asc" },
  { field: "id", direction: "asc" },
] as const satisfies QuerySelectArgs<K>["orderBy"];

export const list = (args: QuerySelectArgs<K> & IncludeDeleted) =>
  base.list({ ...args, filter: live(args.filter, args), orderBy: args.orderBy ?? [...DISPLAY_ORDER] });

// ---------------------------------------------------------------------------
// Writes. Writes go through providerService, which validates content.
// ---------------------------------------------------------------------------

export const { create } = base;

/** Deleted providers can't be edited. */
export const update = (args: Parameters<typeof base.update>[0]) =>
  base.update({ ...args, filter: live(args.filter) });

/**
 * Soft delete: sets `deletedAt`, checked against the table's **delete**
 * permission. The row stays so the deletion syncs, and linked entries can
 * still show the provider's name.
 */
export const remove = async (args: QuerySelectArgs<K>) => {
  if (isFilterEmpty(args.filter)) return newError({ code: "baseModel:noFilter" });

  const where = generateQueryWhere(schemaName, "delete", { ...args, filter: live(args.filter) });
  if (isError(where)) return where;

  const t = providerSchema;
  const res = await dbMayFail(
    () =>
      txOrDb(args.tx)
        .update(t)
        .set({ deletedAt: sql`now()`, updatedBy: args.authUser?.id ?? SYSTEM_USER.id })
        .where(where)
        .returning({ id: t.id }),
    "providerModel:remove",
  );
  if (isError(res)) return res;
  if (!res.length) return newError({ code: "baseModel:remove:nothingRemoved" });

  return { ids: res.map((r) => r.id) };
};
