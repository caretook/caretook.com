import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { DbFieldKey, DbSchemaName, DbSelect } from "../../db";
import type { ErrorCode } from "../../errors";
import type { BaseModelArgs } from "./baseModel";
import type { Filter, OrderBy, QuerySelectArgs } from "./queryHelpers";

import { sql } from "drizzle-orm";
import { SYSTEM_USER } from "../../constants";
import { dbMayFail, getSchema, txOrDb } from "../../db";
import { isError, newError } from "../../errors";
import { getFunctions } from "./baseModel";
import { generateQueryWhere, isFilterEmpty } from "./queryHelpers";

/** Soft-deleted rows are hidden unless a read asks for them. */
export type IncludeDeleted = { includeDeleted?: boolean };

/** The database error code a soft delete returns: `recipientAllergySchema` → `recipientAllergyModel:remove`. */
type RemoveCode<K extends string> = K extends `${infer Name}Schema` ? `${Name}Model:remove` : never;

/** Tables with a `deletedAt` column whose model has its own remove error code. */
export type SoftDeleteSchemaName = {
  [K in DbSchemaName]: "deletedAt" extends DbFieldKey<K>
    ? RemoveCode<K> extends ErrorCode
      ? K
      : never
    : never;
}[DbSchemaName];

type SoftDeleteTable = PgTable & { id: PgColumn; deletedAt: PgColumn; updatedBy: PgColumn };

export type SoftDeleteModelArgs<K extends SoftDeleteSchemaName, TRow, TModel> = BaseModelArgs<
  K,
  TRow,
  TModel
> & {
  /** The order `list` uses when the caller gives none. */
  defaultOrder?: readonly OrderBy<K>[];
};

/**
 * The base model's functions for a table with soft deletes: reads hide
 * deleted rows unless asked (`includeDeleted`), `update` touches live rows
 * only, and `remove` sets `deletedAt` (checked against the table's
 * **delete** permission) so the row stays and the deletion syncs.
 */
export const softDeleteFunctions = <K extends SoftDeleteSchemaName, TModel, TRow = DbSelect<K>>(
  args: SoftDeleteModelArgs<K, TRow, TModel>,
) => {
  const { schemaName, defaultOrder } = args;
  const base = getFunctions<K, TModel, TRow>(args);
  const removeCode = `${schemaName.slice(0, -"Schema".length)}Model:remove` as RemoveCode<K> & ErrorCode;

  /** The filter plus `deletedAt is null`, unless the read asks for deleted rows. */
  const live = (filter: Filter<K> | undefined, opts: IncludeDeleted = {}): Filter<K> | undefined =>
    opts.includeDeleted ? filter : ({ ...filter, deletedAt: { type: "isNull" } } as Filter<K>);

  const get = (args: QuerySelectArgs<K> & IncludeDeleted) =>
    base.get({ ...args, filter: live(args.filter, args) });

  const getById = (id: string, args: Omit<QuerySelectArgs<K>, "filter"> & IncludeDeleted) =>
    get({ ...args, filter: { id: { type: "eq", value: id } } as Filter<K> });

  const list = (args: QuerySelectArgs<K> & IncludeDeleted) =>
    base.list({
      ...args,
      filter: live(args.filter, args),
      orderBy: args.orderBy ?? (defaultOrder ? [...defaultOrder] : undefined),
    });

  /** Deleted rows can't be edited. */
  const update = (args: Parameters<typeof base.update>[0]) =>
    base.update({ ...args, filter: live(args.filter) });

  /** Soft delete: sets `deletedAt` and `updatedBy`; the row stays so the deletion syncs. */
  const remove = async (args: QuerySelectArgs<K>) => {
    if (isFilterEmpty(args.filter)) return newError({ code: "baseModel:noFilter" });

    const where = generateQueryWhere(schemaName, "delete", { ...args, filter: live(args.filter) });
    if (isError(where)) return where;

    const t = getSchema(schemaName) as unknown as SoftDeleteTable;
    const res = await dbMayFail(
      () =>
        txOrDb(args.tx)
          .update(t)
          .set({ deletedAt: sql`now()`, updatedBy: args.authUser?.id ?? SYSTEM_USER.id })
          .where(where)
          .returning({ id: t.id }),
      removeCode,
    );
    if (isError(res)) return res;
    if (!res.length) return newError({ code: "baseModel:remove:nothingRemoved" });

    return { ids: res.map((r) => String(r.id)) };
  };

  return { live, get, getById, list, create: base.create, update, remove };
};
