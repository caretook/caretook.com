import type { Column, SQL } from "drizzle-orm";
import type {
  DbFieldDataType,
  DbFieldKey,
  DbInsert,
  DbQueryWith,
  DbSchemaName,
  DbUpdate,
  Tx,
} from "../../db";
import type { ProtectedField } from "../../db/schema";
import type { AppError } from "../../errors";
import type { AuthUser, PermissionScope, SchemaPermission } from "../../permissions";

import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  notInArray,
  notLike,
  or,
} from "drizzle-orm";
import { MAX_PAGE_SIZE } from "../../constants";
import { getSchema } from "../../db";
import { isError, newError } from "../../errors";
import { getPermissionScope } from "../../permissions";

// ---------------------------------------------------------------------------
// Arg types
// ---------------------------------------------------------------------------

export type QueryCommonArgs = {
  /** The acting user. `null` means unauthenticated. Use SYSTEM_USER for internal work. */
  authUser: AuthUser | null;
  tx?: Tx;
};

export type Paginate = { limit: number; page: number };

export type QuerySelectArgs<K extends DbSchemaName> = QueryCommonArgs & {
  filter?: Filter<K>;
  orderBy?: OrderBy<K>[];
  paginate?: Paginate;
  with?: DbQueryWith<K>;
};

export type QueryCreateArgs<K extends DbSchemaName> = QueryCommonArgs & {
  data: Omit<DbInsert<K>, ProtectedField>;
};

export type QueryUpdateArgs<K extends DbSchemaName> = QuerySelectArgs<K> & {
  data: Omit<DbUpdate<K>, ProtectedField>;
};

// ---------------------------------------------------------------------------
// Filters: a serializable description of a WHERE clause, safe to accept
// from API callers (field names are checked against the table at runtime).
//
//   { email: { type: "eq", value: "a@b.c" }, role: { type: "inArray", value: ["admin"] } }
//
// Top-level fields are ANDed together.
// ---------------------------------------------------------------------------

export type FilterValueType = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "notLike";
export type FilterArrayType = "inArray" | "notInArray";
export type FilterNoValueType = "isNull" | "isNotNull";
export type FilterGroupType = "and" | "or";

export type FilterItemValue<T> = { type: FilterValueType; value: T };
export type FilterItemArray<T> = { type: FilterArrayType; value: T[] };
export type FilterItemNoValue = { type: FilterNoValueType };
export type FilterItemSingle<T> = FilterItemValue<T> | FilterItemArray<T> | FilterItemNoValue;
export type FilterItemGroup<T> = { type: FilterGroupType; value: FilterItemSingle<T>[] };
export type FilterItem<T> = FilterItemSingle<T> | FilterItemGroup<T>;

export type Filter<K extends DbSchemaName> = {
  [F in DbFieldKey<K>]?: FilterItem<DbFieldDataType<K, F>>;
};

export type OrderBy<K extends DbSchemaName> = {
  field: DbFieldKey<K>;
  direction: "asc" | "desc";
};

// ---------------------------------------------------------------------------
// SQL generation
// ---------------------------------------------------------------------------

export const getColumns = (schemaName: DbSchemaName) =>
  getTableColumns(getSchema(schemaName)) as Record<string, Column | undefined>;

export const filterItemToSql = (column: Column, item: FilterItem<unknown>): SQL | AppError => {
  switch (item.type) {
    case "eq":
      return eq(column, item.value);
    case "ne":
      return ne(column, item.value);
    case "gt":
      return gt(column, item.value);
    case "gte":
      return gte(column, item.value);
    case "lt":
      return lt(column, item.value);
    case "lte":
      return lte(column, item.value);
    case "like":
      return like(column, String(item.value));
    case "ilike":
      return ilike(column, String(item.value));
    case "notLike":
      return notLike(column, String(item.value));
    case "inArray":
      return inArray(column, item.value);
    case "notInArray":
      return notInArray(column, item.value);
    case "isNull":
      return isNull(column);
    case "isNotNull":
      return isNotNull(column);
    case "and":
    case "or": {
      const parts: SQL[] = [];
      for (const child of item.value) {
        const part = filterItemToSql(column, child);
        if (isError(part)) return part;
        parts.push(part);
      }
      const combined = item.type === "and" ? and(...parts) : or(...parts);
      return combined ?? newError({ code: "baseModel:filter:emptyGroup" });
    }
    default:
      return newError({
        code: "baseModel:filter:unknownOperator",
        meta: { type: (item as { type: unknown }).type },
      });
  }
};

export const filterToSql = <K extends DbSchemaName>(
  schemaName: K,
  filter?: Filter<K>,
): SQL | undefined | AppError => {
  if (!filter) return undefined;
  const columns = getColumns(schemaName);
  const parts: SQL[] = [];

  for (const [field, item] of Object.entries(filter)) {
    if (item === undefined) continue;
    const column = columns[field];
    if (!column) {
      return newError({ code: "baseModel:filter:unknownField", meta: { schemaName, field } });
    }
    const part = filterItemToSql(column, item as FilterItem<unknown>);
    if (isError(part)) return part;
    parts.push(part);
  }

  return and(...parts);
};

/** The WHERE clause a permission scope requires (`undefined` = unrestricted). */
export const scopeToSql = (schemaName: DbSchemaName, scope: PermissionScope): SQL | undefined => {
  if (scope.type === "all") return undefined;
  const column = getColumns(schemaName)[scope.ownerField];
  // A misconfigured ownerField must never widen access.
  if (!column) throw new Error(`ownerField "${scope.ownerField}" not found on ${schemaName}`);
  return eq(column, scope.ownerId);
};

/**
 * The caller's filter ANDed with the permission scope. Every model read and
 * write goes through this, which is what makes RBAC part of the model layer.
 */
export const generateQueryWhere = <K extends DbSchemaName>(
  schemaName: K,
  permission: SchemaPermission,
  args: QuerySelectArgs<K>,
): SQL | undefined | AppError => {
  const scope = getPermissionScope(schemaName, permission, args.authUser);
  if (isError(scope)) return scope;

  const filterWhere = filterToSql(schemaName, args.filter);
  if (isError(filterWhere)) return filterWhere;

  return and(filterWhere, scopeToSql(schemaName, scope));
};

/**
 * Defaults to createdAt, then id, so pagination is stable (UUIDs alone have
 * no meaningful order). `id` is always appended as a tiebreaker.
 */
export const generateOrderBy = <K extends DbSchemaName>(
  schemaName: K,
  orderBy?: OrderBy<K>[],
): SQL[] | AppError => {
  const columns = getColumns(schemaName);
  const order = orderBy?.length
    ? orderBy
    : [{ field: "createdAt", direction: "asc" as const }].filter((o) => columns[o.field]);

  const clauses: SQL[] = [];
  for (const { field, direction } of order) {
    const column = columns[field];
    if (!column) {
      return newError({ code: "baseModel:orderBy:unknownField", meta: { schemaName, field } });
    }
    clauses.push(direction === "desc" ? desc(column) : asc(column));
  }

  if (columns.id && !order.some((o) => o.field === "id")) clauses.push(asc(columns.id));
  return clauses;
};

export const paginate = (args: { paginate?: Paginate }) => {
  if (!args.paginate) return {};
  const limit = Math.min(Math.max(Math.trunc(args.paginate.limit) || 0, 1), MAX_PAGE_SIZE);
  const page = Math.max(Math.trunc(args.paginate.page) || 1, 1);
  return { limit, offset: (page - 1) * limit };
};

export const isFilterEmpty = (filter?: object) =>
  !filter || Object.values(filter).every((item) => item === undefined);
