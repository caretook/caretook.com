import type { MedicationPass, Tx } from "../../db";
import type { Filter, QuerySelectArgs } from "../base/queryHelpers";

import { and, eq, isNull, sql } from "drizzle-orm";
import { SYSTEM_USER } from "../../constants";
import { dbMayFail, txOrDb } from "../../db";
import { medicationPassSchema } from "../../db/schema";
import { isError, newError } from "../../errors";
import * as baseModel from "../base";
import { generateQueryWhere, isFilterEmpty } from "../base/queryHelpers";

export const schemaName = "medicationPassSchema";
type K = typeof schemaName;

export const dbToModel = (row: MedicationPass) => row;

const base = baseModel.getFunctions({ schemaName, dbToModel });

/** Soft-deleted passes are hidden unless a read asks for them. */
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

/** In the day's order: `sortPasses` in medicationPass.ts has the full rule. */
export const PASS_ORDER = [
  { field: "sortOrder", direction: "asc" },
  { field: "time", direction: "asc" },
  { field: "id", direction: "asc" },
] as const satisfies QuerySelectArgs<K>["orderBy"];

export const list = (args: QuerySelectArgs<K> & IncludeDeleted) =>
  base.list({ ...args, filter: live(args.filter, args), orderBy: args.orderBy ?? [...PASS_ORDER] });

// ---------------------------------------------------------------------------
// Writes go through medicationPassService, which keeps names unique, writes a retime's
// change entry and rewrites schedules when a pass is deleted.
// ---------------------------------------------------------------------------

export const { create } = base;

/** Deleted passes can't be edited. */
export const update = (args: Parameters<typeof base.update>[0]) =>
  base.update({ ...args, filter: live(args.filter) });

/**
 * Soft delete: sets `deletedAt`, checked against the table's **delete**
 * permission. The row stays so the deletion syncs.
 */
export const remove = async (args: QuerySelectArgs<K>) => {
  if (isFilterEmpty(args.filter)) return newError({ code: "baseModel:noFilter" });

  const where = generateQueryWhere(schemaName, "delete", { ...args, filter: live(args.filter) });
  if (isError(where)) return where;

  const t = medicationPassSchema;
  const res = await dbMayFail(
    () =>
      txOrDb(args.tx)
        .update(t)
        .set({ deletedAt: sql`now()`, updatedBy: args.authUser?.id ?? SYSTEM_USER.id })
        .where(where)
        .returning({ id: t.id }),
    "medicationPassModel:remove",
  );
  if (isError(res)) return res;
  if (!res.length) return newError({ code: "baseModel:remove:nothingRemoved" });

  return { ids: res.map((r) => r.id) };
};

/**
 * Pass `id`, live, locked `FOR UPDATE` until the transaction ends (null when
 * it's gone or deleted), so a retime or delete and the schedules it touches
 * change together. Internal: no permission scope; callers check visibility.
 */
export const lockLive = async (id: string, tx: Tx) => {
  const t = medicationPassSchema;
  const rows = await dbMayFail(
    () =>
      tx
        .select()
        .from(t)
        .where(and(eq(t.id, id), isNull(t.deletedAt)))
        .for("update"),
    "medicationPassModel:lock",
  );
  if (isError(rows)) return rows;
  return rows[0] ?? null;
};

/**
 * Hold the group's pass list until the transaction ends (a transaction-scoped
 * advisory lock), so two saves can't both take the last free name or slot.
 */
export const lockGroup = (groupId: string, tx: Tx) =>
  dbMayFail(
    () => tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`medication_pass:${groupId}`}))`),
    "medicationPassModel:lock",
  );
