import type { CarePeriod } from "../../db";
import type { Filter, QuerySelectArgs } from "../base/queryHelpers";

import { sql } from "drizzle-orm";
import { SYSTEM_USER } from "../../constants";
import { dbMayFail, txOrDb } from "../../db";
import { carePeriodSchema } from "../../db/schema";
import { isError, newError } from "../../errors";
import * as baseModel from "../base";
import { generateQueryWhere, isFilterEmpty } from "../base/queryHelpers";

export const schemaName = "carePeriodSchema";
type K = typeof schemaName;

export const dbToModel = (row: CarePeriod) => row;

const base = baseModel.getFunctions({ schemaName, dbToModel });

/** Soft-deleted periods are hidden unless a read asks for them. */
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

/** The track's order: start, then when it was created, then id (see carePeriodTrack.ts). */
export const TRACK_ORDER = [
  { field: "startedAt", direction: "asc" },
  { field: "createdAt", direction: "asc" },
  { field: "id", direction: "asc" },
] as const satisfies QuerySelectArgs<K>["orderBy"];

export const list = (args: QuerySelectArgs<K> & IncludeDeleted) =>
  base.list({ ...args, filter: live(args.filter, args), orderBy: args.orderBy ?? [...TRACK_ORDER] });

// ---------------------------------------------------------------------------
// Writes. Writes go through carePeriodService, which validates content and
// checks the place and the start.
// ---------------------------------------------------------------------------

export const { create } = base;

/** Deleted periods can't be edited. */
export const update = (args: Parameters<typeof base.update>[0]) =>
  base.update({ ...args, filter: live(args.filter) });

/**
 * Soft delete: sets `deletedAt`, checked against the table's **delete**
 * permission. The row stays so the deletion syncs; the period before it
 * then runs on (see carePeriodTrack.ts).
 */
export const remove = async (args: QuerySelectArgs<K>) => {
  if (isFilterEmpty(args.filter)) return newError({ code: "baseModel:noFilter" });

  const where = generateQueryWhere(schemaName, "delete", { ...args, filter: live(args.filter) });
  if (isError(where)) return where;

  const t = carePeriodSchema;
  const res = await dbMayFail(
    () =>
      txOrDb(args.tx)
        .update(t)
        .set({ deletedAt: sql`now()`, updatedBy: args.authUser?.id ?? SYSTEM_USER.id })
        .where(where)
        .returning({ id: t.id }),
    "carePeriodModel:remove",
  );
  if (isError(res)) return res;
  if (!res.length) return newError({ code: "baseModel:remove:nothingRemoved" });

  return { ids: res.map((r) => r.id) };
};
