import type { SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { DbQueryWith, DbSchemaName, DbSelect, Tx } from "../../db";
import type { AuthUser } from "../../permissions";
import type {
  Filter,
  QueryCreateArgs,
  QuerySelectArgs,
  QueryUpdateArgs,
} from "./queryHelpers";

import { count, eq } from "drizzle-orm";
import { SYSTEM_USER } from "../../constants";
import { dbMayFail, getSchema, txOrDb } from "../../db";
import { PROTECTED_FIELDS } from "../../db/schema";
import { isError, newError } from "../../errors";
import { getPermissionScope, getUnauthorizedFields, rejectError } from "../../permissions";
import {
  generateOrderBy,
  generateQueryWhere,
  isFilterEmpty,
  paginate,
} from "./queryHelpers";

export type BaseModelArgs<K extends DbSchemaName, TRow, TModel> = {
  schemaName: K;
  /** Maps a db row (including any `with` relations) to the model shape. */
  dbToModel: (row: TRow) => TModel;
  /** Relations loaded by default on reads. */
  getWith?: () => DbQueryWith<K>;
};

// ---------------------------------------------------------------------------
// Drizzle's query types don't survive a generic table name, so the base model
// talks to drizzle through these narrowed shapes. The casts live here only;
// models built on top stay fully typed.
// ---------------------------------------------------------------------------

type RelationalQuery = {
  findFirst(config: { where?: SQL; with?: unknown }): PromiseLike<unknown>;
  findMany(config: {
    where?: SQL;
    with?: unknown;
    orderBy?: SQL[];
    limit?: number;
    offset?: number;
  }): PromiseLike<unknown[]>;
};

type IdTable = PgTable & { id: PgColumn };
type Row = Record<string, unknown>;

const relationalQuery = (schemaName: DbSchemaName, tx?: Tx) =>
  txOrDb(tx).query[schemaName] as unknown as RelationalQuery;

const getTable = (schemaName: DbSchemaName) => getSchema(schemaName) as unknown as IdTable;

const actorId = (authUser: AuthUser | null) => authUser?.id ?? SYSTEM_USER.id;

const omitFields = (data: Row, fields: readonly string[]): Row =>
  Object.fromEntries(Object.entries(data).filter(([key]) => !fields.includes(key)));

const idFilter = <K extends DbSchemaName>(id: string) =>
  ({ id: { type: "eq", value: id } }) as Filter<K>;

const idsFilter = <K extends DbSchemaName>(ids: string[]) =>
  ({ id: { type: "inArray", value: ids } }) as Filter<K>;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const get =
  <K extends DbSchemaName, TRow, TModel>({ schemaName, dbToModel, getWith }: BaseModelArgs<K, TRow, TModel>) =>
  async (args: QuerySelectArgs<K>) => {
    const where = generateQueryWhere(schemaName, "read", args);
    if (isError(where)) return where;

    const row = await dbMayFail(
      () => relationalQuery(schemaName, args.tx).findFirst({ where, with: args.with ?? getWith?.() }),
      "baseModel:get",
      { schemaName },
    );
    if (isError(row)) return row;

    return row ? dbToModel(row as TRow) : null;
  };

export const getById =
  <K extends DbSchemaName, TRow, TModel>(model: BaseModelArgs<K, TRow, TModel>) =>
  (id: string, args: Omit<QuerySelectArgs<K>, "filter">) =>
    get(model)({ ...args, filter: idFilter<K>(id) });

export const list =
  <K extends DbSchemaName, TRow, TModel>({ schemaName, dbToModel, getWith }: BaseModelArgs<K, TRow, TModel>) =>
  async (args: QuerySelectArgs<K>) => {
    const where = generateQueryWhere(schemaName, "list", args);
    if (isError(where)) return where;

    const orderBy = generateOrderBy(schemaName, args.orderBy);
    if (isError(orderBy)) return orderBy;

    const rows = await dbMayFail(
      () =>
        relationalQuery(schemaName, args.tx).findMany({
          where,
          orderBy,
          ...paginate(args),
          with: args.with ?? getWith?.(),
        }),
      "baseModel:list",
      { schemaName },
    );
    if (isError(rows)) return rows;

    const countRes = await dbMayFail(
      () => txOrDb(args.tx).select({ count: count() }).from(getTable(schemaName)).where(where),
      "baseModel:list",
      { schemaName },
    );
    if (isError(countRes)) return countRes;

    return {
      count: countRes[0]?.count ?? 0,
      data: rows.map((row) => dbToModel(row as TRow)),
    };
  };

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export const create =
  <K extends DbSchemaName, TRow, TModel>(model: BaseModelArgs<K, TRow, TModel>) =>
  async (args: QueryCreateArgs<K>) => {
    const { schemaName } = model;
    const { authUser } = args;

    const scope = getPermissionScope(schemaName, "create", authUser);
    if (isError(scope)) return scope;

    const data = omitFields(args.data as Row, PROTECTED_FIELDS);

    const unauthorizedFields = getUnauthorizedFields({ schemaName, permission: "create", authUser, data });
    if (unauthorizedFields.length) {
      return newError({ code: "permissions:fieldUnauthorized", meta: { fields: unauthorizedFields } });
    }

    // `owned` create: the new row must belong to the acting user.
    if (scope.type === "owned" && data[scope.ownerField] !== scope.ownerId) {
      return rejectError(authUser);
    }

    // `id` may be supplied: offline clients generate their own UUIDs.
    const table = getTable(schemaName);
    const res = await dbMayFail(
      () =>
        txOrDb(args.tx)
          .insert(table)
          .values({ ...data, createdBy: actorId(authUser), updatedBy: actorId(authUser) })
          .returning({ id: table.id }),
      "baseModel:create",
      { schemaName },
    );
    if (isError(res)) return res;

    const created = res[0];
    if (!created) return newError({ code: "baseModel:create:nothingCreated" });

    // Re-read through `get` so the result has relations and read permissions applied.
    return getById(model)(String(created.id), args);
  };

export const update =
  <K extends DbSchemaName, TRow, TModel>(model: BaseModelArgs<K, TRow, TModel>) =>
  async (args: QueryUpdateArgs<K>) => {
    const { schemaName } = model;
    const { authUser } = args;

    // Never allow an unfiltered update (it would hit every row in scope).
    if (isFilterEmpty(args.filter)) return newError({ code: "baseModel:noFilter" });

    const scope = getPermissionScope(schemaName, "update", authUser);
    if (isError(scope)) return scope;

    const data = omitFields(args.data as Row, ["id", ...PROTECTED_FIELDS]);

    const unauthorizedFields = getUnauthorizedFields({ schemaName, permission: "update", authUser, data });
    if (unauthorizedFields.length) {
      return newError({ code: "permissions:fieldUnauthorized", meta: { fields: unauthorizedFields } });
    }

    // `owned` update: rows can't be handed to another user.
    if (scope.type === "owned" && scope.ownerField in data && data[scope.ownerField] !== scope.ownerId) {
      return rejectError(authUser);
    }

    const where = generateQueryWhere(schemaName, "update", args);
    if (isError(where)) return where;

    const table = getTable(schemaName);
    const res = await dbMayFail(
      () =>
        txOrDb(args.tx)
          .update(table)
          .set({ ...data, updatedBy: actorId(authUser) })
          .where(where)
          .returning({ id: table.id }),
      "baseModel:update",
      { schemaName },
    );
    if (isError(res)) return res;
    if (!res.length) return newError({ code: "baseModel:update:nothingUpdated" });

    // Re-read by id: the update may have changed fields the filter matched on.
    const updated = await list(model)({
      authUser,
      tx: args.tx,
      with: args.with,
      filter: idsFilter<K>(res.map((r) => String(r.id))),
    });
    if (isError(updated)) return updated;
    return updated.data;
  };

export const remove =
  <K extends DbSchemaName, TRow, TModel>({ schemaName }: BaseModelArgs<K, TRow, TModel>) =>
  async (args: QuerySelectArgs<K>) => {
    if (isFilterEmpty(args.filter)) return newError({ code: "baseModel:noFilter" });

    const where = generateQueryWhere(schemaName, "delete", args);
    if (isError(where)) return where;

    const table = getTable(schemaName);
    const res = await dbMayFail(
      () => txOrDb(args.tx).delete(table).where(where).returning({ id: table.id }),
      "baseModel:remove",
      { schemaName },
    );
    if (isError(res)) return res;
    if (!res.length) return newError({ code: "baseModel:remove:nothingRemoved" });

    return { ids: res.map((r) => String(r.id)) };
  };

/**
 * Create, or update when a row with `data.id` already exists. This is the
 * shape of a PowerSync PUT. Permissions are enforced by create/update.
 */
export const upsert =
  <K extends DbSchemaName, TRow, TModel>(model: BaseModelArgs<K, TRow, TModel>) =>
  async (args: QueryCreateArgs<K>) => {
    const id = (args.data as { id?: string }).id;
    if (!id) return create(model)(args);

    // Existence check only, with no permission scope: it decides which path
    // to take, and that path enforces permissions.
    const table = getTable(model.schemaName);
    const existing = await dbMayFail(
      () => txOrDb(args.tx).select({ id: table.id }).from(table).where(eq(table.id, id)).limit(1),
      "baseModel:upsert",
      { schemaName: model.schemaName },
    );
    if (isError(existing)) return existing;
    if (!existing.length) return create(model)(args);

    const updated = await update(model)({ ...args, filter: idFilter<K>(id) });
    if (isError(updated)) return updated;
    return updated[0] ?? null;
  };

/** Build the standard CRUD functions for a model. */
export const getFunctions = <K extends DbSchemaName, TModel, TRow = DbSelect<K>>(
  args: BaseModelArgs<K, TRow, TModel>,
) => ({
  create: create(args),
  get: get(args),
  getById: getById(args),
  list: list(args),
  remove: remove(args),
  update: update(args),
  upsert: upsert(args),
});

export type BaseModel<K extends DbSchemaName, TModel, TRow = DbSelect<K>> = ReturnType<
  typeof getFunctions<K, TModel, TRow>
>;
