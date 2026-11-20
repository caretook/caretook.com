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
import type { AuthUser, PermissionScope, SchemaPermission, ScopeRule } from "../../permissions";

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
  sql,
} from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";
import { MAX_PAGE_SIZE } from "../../constants";
import { getSchema } from "../../db";
import { careGroupMemberSchema } from "../../db/schema";
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

/**
 * `T` without the fields callers may never write. Not `Omit`: on a generic
 * `DbInsert<K>`, `Omit` drops optional columns (`id`, anything with a
 * default) once K is instantiated. Key remapping keeps them.
 */
export type WithoutProtected<T> = { [P in keyof T as P extends ProtectedField ? never : P]: T[P] };

export type QueryCreateArgs<K extends DbSchemaName> = QueryCommonArgs & {
  data: WithoutProtected<DbInsert<K>>;
};

export type QueryUpdateArgs<K extends DbSchemaName> = QuerySelectArgs<K> & {
  data: WithoutProtected<DbUpdate<K>>;
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

// ---------------------------------------------------------------------------
// Permission scopes
// ---------------------------------------------------------------------------

// Aliased so the subqueries never collide with the outer table (queries on
// care_group_member itself are scoped by a subquery on care_group_member).
const scopeMember = alias(careGroupMemberSchema, "scope_member");
const scopePeer = alias(careGroupMemberSchema, "scope_peer");
const qb = new QueryBuilder();

/** Ids of the groups `userId` belongs to with one of `roles`. */
const actorGroupIds = (userId: string, roles: readonly string[]) =>
  qb
    .select({ groupId: scopeMember.groupId })
    .from(scopeMember)
    .where(and(eq(scopeMember.userId, userId), inArray(scopeMember.role, roles as never[])));

/**
 * The condition one rule puts on `operand`: a column of the scoped table, or
 * a bound value when checking data about to be written.
 */
export const scopeRuleToSql = (operand: SQL, rule: ScopeRule): SQL => {
  switch (rule.type) {
    case "owned":
      return eq(operand, rule.userId);
    case "group":
      return inArray(operand, actorGroupIds(rule.userId, rule.groupRoles));
    case "groupUser":
      return inArray(
        operand,
        qb
          .select({ userId: scopePeer.userId })
          .from(scopePeer)
          .where(inArray(scopePeer.groupId, actorGroupIds(rule.userId, rule.groupRoles))),
      );
  }
};

/** The WHERE clause a permission scope requires (`undefined` = unrestricted). */
export const scopeToSql = (schemaName: DbSchemaName, scope: PermissionScope): SQL | undefined => {
  if (scope.type === "all") return undefined;
  const columns = getColumns(schemaName);
  const parts = scope.rules.map((rule) => {
    const column = columns[rule.field];
    // A misconfigured field must never widen access.
    if (!column) throw new Error(`Permission field "${rule.field}" not found on ${schemaName}`);
    return scopeRuleToSql(sql`${column}`, rule);
  });
  // An empty rule list grants nothing (getPermissionScope never returns one).
  return or(...parts) ?? sql`false`;
};

/**
 * A scope whose group rules show only some fields (`groupFields`): `whole`
 * is true for rows the actor may see in full (the scope's other rules), and
 * `visible` is what everyone in scope may see. Undefined when nothing is
 * limited.
 */
export type FieldLimits = { whole: SQL; visible: ReadonlySet<string> };

export const fieldLimits = (schemaName: DbSchemaName, scope: PermissionScope): FieldLimits | undefined => {
  if (scope.type === "all") return undefined;
  const limited = scope.rules.filter((rule) => rule.type !== "owned" && rule.fields);
  if (!limited.length) return undefined;
  const columns = getColumns(schemaName);
  const wholeRules = scope.rules.filter((rule) => !limited.includes(rule));
  const whole =
    or(
      ...wholeRules.map((rule) => {
        const column = columns[rule.field];
        if (!column) throw new Error(`Permission field "${rule.field}" not found on ${schemaName}`);
        return scopeRuleToSql(sql`${column}`, rule);
      }),
    ) ?? sql`false`;
  const visible = new Set(limited.flatMap((rule) => (rule.type === "owned" ? [] : (rule.fields ?? []))));
  return { whole, visible };
};

/** Fields a filter or order names, which a limited row mustn't be matched or sorted on. */
const namedFields = <K extends DbSchemaName>(args: QuerySelectArgs<K>) => [
  ...Object.entries(args.filter ?? {})
    .filter(([, item]) => item !== undefined)
    .map(([field]) => field),
  ...(args.orderBy ?? []).map((o) => String(o.field)),
];

/**
 * The caller's filter ANDed with the permission scope. Every model read and
 * write goes through this, which is what makes RBAC part of the model layer.
 * A filter or order on a field a limited row hides only matches whole rows,
 * so hidden values can't be probed.
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

  const limits = fieldLimits(schemaName, scope);
  const probesHidden = !!limits && namedFields(args).some((field) => !limits.visible.has(field));

  return and(filterWhere, scopeToSql(schemaName, scope), probesHidden ? limits.whole : undefined);
};

/** The extra column a limited read adds: whether the row may be shown whole. */
export const WHOLE_ROW_KEY = "__wholeRow";

/**
 * The relational-query selection for a read whose scope limits fields: the
 * hidden columns are replaced by `CASE WHEN <whole> THEN col END`, so a
 * limited row's hidden values never leave the database, plus WHOLE_ROW_KEY.
 * Undefined when the scope limits nothing.
 */
export const limitedSelection = (
  schemaName: DbSchemaName,
  permission: SchemaPermission,
  authUser: AuthUser | null,
) => {
  const scope = getPermissionScope(schemaName, permission, authUser);
  if (isError(scope)) return undefined;
  const limits = fieldLimits(schemaName, scope);
  if (!limits) return undefined;

  const hidden = Object.entries(getColumns(schemaName)).filter(
    (entry): entry is [string, Column] => !!entry[1] && !limits.visible.has(entry[0]),
  );
  return {
    visible: limits.visible,
    columns: Object.fromEntries(hidden.map(([key]) => [key, false])),
    extras: {
      ...Object.fromEntries(
        hidden.map(([key, column]) => [
          key,
          sql`CASE WHEN ${limits.whole} THEN ${column} END`.mapWith(column).as(key),
        ]),
      ),
      [WHOLE_ROW_KEY]: sql<boolean>`(${limits.whole})`.as(WHOLE_ROW_KEY),
    },
  };
};

/** A limited read's row as the model sees it: whole, or only its visible fields. */
export const applyLimits = (row: Record<string, unknown>, visible: ReadonlySet<string>) => {
  const { [WHOLE_ROW_KEY]: whole, ...rest } = row;
  if (whole === true) return rest;
  return Object.fromEntries(Object.entries(rest).filter(([key]) => visible.has(key)));
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
