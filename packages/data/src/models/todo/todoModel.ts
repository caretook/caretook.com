import type { Todo, Tx } from "../../db";
import type { Filter, QuerySelectArgs } from "../base/queryHelpers";

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { SYSTEM_USER } from "../../constants";
import { dbMayFail, txOrDb } from "../../db";
import { todoSchema } from "../../db/schema";
import { isError, newError } from "../../errors";
import * as baseModel from "../base";
import { generateQueryWhere, isFilterEmpty } from "../base/queryHelpers";

export const schemaName = "todoSchema";
type K = typeof schemaName;

export const dbToModel = (row: Todo) => row;

const base = baseModel.getFunctions({ schemaName, dbToModel });

/** Soft-deleted todos are hidden unless a read asks for them. */
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

/** Storage order (screens sort with todoOrder and doneOrder in todoRules.ts). */
export const DEFAULT_ORDER = [
  { field: "createdAt", direction: "asc" },
  { field: "id", direction: "asc" },
] as const satisfies QuerySelectArgs<K>["orderBy"];

export const list = (args: QuerySelectArgs<K> & IncludeDeleted) =>
  base.list({ ...args, filter: live(args.filter, args), orderBy: args.orderBy ?? [...DEFAULT_ORDER] });

/**
 * Lock the todo `FOR UPDATE` (deleted ones too) inside `tx` and return it, or
 * null. Unscoped: todoService checks visibility and the role itself. A tick,
 * reopen, skip, Undo or restore takes it first and decides from this row, so
 * two of them on one todo run one after the other (B-384), and the second
 * sees what the first committed.
 */
export const lockById = async (id: string, tx: Tx) => {
  const t = todoSchema;
  const res = await dbMayFail(
    () => tx.select().from(t).where(eq(t.id, id)).limit(1).for("update"),
    "todoModel:lockById",
  );
  if (isError(res)) return res;
  const [row] = res;
  return row ? dbToModel(row) : null;
};

/**
 * The transaction's clock (Postgres `now()`, the time it started), to the
 * millisecond, rounded down. A row made in `tx` gets a `created_at` at or
 * after it.
 */
export const transactionNow = async (tx: Tx) => {
  const res = await dbMayFail(
    () =>
      tx.execute<{ ms: number | string }>(sql`SELECT floor(extract(epoch FROM now()) * 1000)::float8 AS ms`),
    "todoModel:transactionNow",
  );
  if (isError(res)) return res;
  return new Date(Number(res.rows[0]?.ms));
};

// ---------------------------------------------------------------------------
// Writes. Writes go through todoService, which validates content, checks the
// assignee and links, and limits viewers to completing their own todos.
// ---------------------------------------------------------------------------

export const { create } = base;

/** Deleted todos can't be edited. */
export const update = (args: Parameters<typeof base.update>[0]) =>
  base.update({ ...args, filter: live(args.filter) });

/**
 * Bring a soft-deleted todo back with `data`, as the system: a repeating
 * todo's next occurrence made again after an Undo took it away (todoService
 * is its only caller). A live or missing todo is left alone.
 */
export const restore = async (id: string, data: Partial<Todo>, tx?: Tx) => {
  const t = todoSchema;
  const res = await dbMayFail(
    () =>
      txOrDb(tx)
        .update(t)
        // Made again: `created_at` is now, so `reopen` finds it as the
        // occurrence made after the tick (its successor rule).
        .set({ ...data, deletedAt: null, createdAt: sql`now()`, updatedBy: SYSTEM_USER.id })
        .where(and(eq(t.id, id), isNotNull(t.deletedAt)))
        .returning(),
    "todoModel:restore",
  );
  if (isError(res)) return res;
  return res[0] ?? null;
};

/**
 * Soft delete: sets `deletedAt`, checked against the table's **delete**
 * permission. The row stays so the deletion syncs.
 */
export const remove = async (args: QuerySelectArgs<K>) => {
  if (isFilterEmpty(args.filter)) return newError({ code: "baseModel:noFilter" });

  const where = generateQueryWhere(schemaName, "delete", { ...args, filter: live(args.filter) });
  if (isError(where)) return where;

  const t = todoSchema;
  const res = await dbMayFail(
    () =>
      txOrDb(args.tx)
        .update(t)
        .set({ deletedAt: sql`now()`, updatedBy: args.authUser?.id ?? SYSTEM_USER.id })
        .where(where)
        .returning({ id: t.id }),
    "todoModel:remove",
  );
  if (isError(res)) return res;
  if (!res.length) return newError({ code: "baseModel:remove:nothingRemoved" });

  return { ids: res.map((r) => r.id) };
};
