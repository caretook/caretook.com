import type { SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { DbQueryWith, DbSchemaName, DbSelect, Tx } from "../../db";
import type { AppError } from "../../errors";
import type { AuthUser, PermissionScope } from "../../permissions";
import type { Filter, QueryCreateArgs, QuerySelectArgs, QueryUpdateArgs } from "./queryHelpers";

import { count, eq, or, sql } from "drizzle-orm";
import { SYSTEM_USER } from "../../constants";
import { dbMayFail, getSchema, txOrDb } from "../../db";
import { PROTECTED_FIELDS } from "../../db/schema";
import { isError, newError } from "../../errors";
import { getPermissionScope, getUnauthorizedFields, rejectError } from "../../permissions";
import { generateOrderBy, generateQueryWhere, isFilterEmpty, paginate, scopeRuleToSql } from "./queryHelpers";

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

/**
 * Whether `data` (a row about to be written) satisfies at least one of the
 * scope's rules whose field it sets. `owned` is checked here; group rules
 * ask the database, since they depend on membership.
 */
const dataInScope = async (scope: PermissionScope, data: Row, tx?: Tx): Promise<boolean | AppError> => {
  if (scope.type === "all") return true;
  const rules = scope.rules.filter((rule) => data[rule.field] !== undefined);

  if (rules.some((rule) => rule.type === "owned" && data[rule.field] === rule.userId)) return true;

  const groupRules = rules.filter((rule) => rule.type !== "owned");
  if (!groupRules.length) return false;

  const res = await dbMayFail(
    () =>
      txOrDb(tx).execute<{ ok: boolean }>(
        sql`SELECT (${or(...groupRules.map((rule) => scopeRuleToSql(sql`${data[rule.field]}::uuid`, rule)))}) AS ok`,
      ),
    "baseModel:scopeCheck",
  );
  if (isError(res)) return res;
  return res.rows[0]?.ok === true;
};

const idFilter = <K extends DbSchemaName>(id: string) => ({ id: { type: "eq", value: id } }) as Filter<K>;

const idsFilter = <K extends DbSchemaName>(ids: string[]) =>
  ({ id: { type: "inArray", value: ids } }) as Filter<K>;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const get =
  <K extends DbSchemaName, TRow, TModel>({
    schemaName,
    dbToModel,
    getWith,
  }: BaseModelArgs<K, TRow, TModel>) =>
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
  <K extends DbSchemaName, TRow, TModel>({
    schemaName,
    dbToModel,
    getWith,
  }: BaseModelArgs<K, TRow, TModel>) =>
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

    const data = omitFields(args.data, PROTECTED_FIELDS);

    const unauthorizedFields = getUnauthorizedFields({ schemaName, permission: "create", authUser, data });
    if (unauthorizedFields.length) {
      return newError({ code: "permissions:fieldUnauthorized", meta: { fields: unauthorizedFields } });
    }

    // A scoped create must land inside the scope: an `owned` row belongs to
    // the actor, a `group` row to a group where the actor has a granting role.
    const inScope = await dataInScope(scope, data, args.tx);
    if (isError(inScope)) return inScope;
    if (!inScope) return rejectError(authUser);

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

    const data = omitFields(args.data, ["id", ...PROTECTED_FIELDS]);

    const unauthorizedFields = getUnauthorizedFields({ schemaName, permission: "update", authUser, data });
    if (unauthorizedFields.length) {
      return newError({ code: "permissions:fieldUnauthorized", meta: { fields: unauthorizedFields } });
    }

    // Rows can't be moved out of the actor's scope (handed to another user
    // or another group). Only checked when the update sets a scoped field.
    if (scope.type === "rules" && scope.rules.some((rule) => data[rule.field] !== undefined)) {
      const inScope = await dataInScope(scope, data, args.tx);
      if (isError(inScope)) return inScope;
      if (!inScope) return rejectError(authUser);
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
