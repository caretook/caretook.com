import type { MedicationPass, Tx } from "../../db";
import type { QuerySelectArgs } from "../base/queryHelpers";

import { and, eq, isNull, sql } from "drizzle-orm";
import { dbMayFail } from "../../db";
import { medicationPassSchema } from "../../db/schema";
import { isError } from "../../errors";
import { softDeleteFunctions } from "../base/softDeleteModel";

export type { IncludeDeleted } from "../base/softDeleteModel";

export const schemaName = "medicationPassSchema";
type K = typeof schemaName;

export const dbToModel = (row: MedicationPass) => row;

/** In the day's order: `sortPasses` in medicationPass.ts has the full rule. */
export const PASS_ORDER = [
  { field: "time", direction: "asc" },
  { field: "name", direction: "asc" },
  { field: "id", direction: "asc" },
] as const satisfies QuerySelectArgs<K>["orderBy"];

// Soft-deleted passes are hidden unless a read asks for them, and can't be
// edited; `remove` sets `deletedAt`. Writes go through medicationPassService,
// which keeps names unique, writes a retime's change entry and rewrites
// schedules when a pass is deleted.
export const { get, getById, list, create, update, remove } = softDeleteFunctions({
  schemaName,
  dbToModel,
  defaultOrder: PASS_ORDER,
});

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
