import type { Todo, Tx } from "../../db";
import type { QuerySelectArgs } from "../base/queryHelpers";

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { SYSTEM_USER } from "../../constants";
import { dbMayFail, txOrDb } from "../../db";
import { todoSchema } from "../../db/schema";
import { isError } from "../../errors";
import { softDeleteFunctions } from "../base/softDeleteModel";

export type { IncludeDeleted } from "../base/softDeleteModel";

export const schemaName = "todoSchema";
type K = typeof schemaName;

export const dbToModel = (row: Todo) => row;

/** Storage order (screens sort with todoOrder and doneOrder in todoRules.ts). */
export const DEFAULT_ORDER = [
  { field: "createdAt", direction: "asc" },
  { field: "id", direction: "asc" },
] as const satisfies QuerySelectArgs<K>["orderBy"];

// Soft-deleted todos are hidden unless a read asks for them, and can't be
// edited; `remove` sets `deletedAt`. Writes go through todoService, which
// validates content, checks the assignee and links, and limits viewers to
// completing their own todos.
export const { get, getById, list, create, update, remove } = softDeleteFunctions({
  schemaName,
  dbToModel,
  defaultOrder: DEFAULT_ORDER,
});

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
 * Stamp todo `id` (a repeating todo's next) as made after `predecessorId`:
 * its `created_at` at least 1 ms past the predecessor's. A todo made and
 * ticked in one transaction (an offline one's PUT carrying `done_at`) would
 * otherwise share `now()` with its next, and reopen's successor rule wants
 * the next made strictly after it. As the device's `planNext`.
 */
export const stampMadeAfter = async (id: string, predecessorId: string, tx: Tx) => {
  const t = todoSchema;
  const res = await dbMayFail(
    () =>
      tx.execute(
        sql`UPDATE ${t} SET created_at = greatest(${t.createdAt},
              (SELECT p.created_at FROM ${t} p WHERE p.id = ${predecessorId}) + interval '1 millisecond')
            WHERE ${t.id} = ${id}`,
      ),
    "todoModel:stampMadeAfter",
  );
  return isError(res) ? res : null;
};
