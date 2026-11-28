import type { Provider, Tx } from "../../db";
import type { QuerySelectArgs } from "../base/queryHelpers";

import { and, eq, isNull } from "drizzle-orm";
import { dbMayFail } from "../../db";
import { providerSchema } from "../../db/schema";
import { isError } from "../../errors";
import { softDeleteFunctions } from "../base/softDeleteModel";

export type { IncludeDeleted } from "../base/softDeleteModel";

export const schemaName = "providerSchema";
type K = typeof schemaName;

export const dbToModel = (row: Provider) => row;

/** The display order: primary first, then current, then past, each by name. */
export const DISPLAY_ORDER = [
  { field: "isPrimary", direction: "desc" },
  { field: "status", direction: "asc" },
  { field: "name", direction: "asc" },
  { field: "id", direction: "asc" },
] as const satisfies QuerySelectArgs<K>["orderBy"];

// Soft-deleted providers are hidden unless a read asks for them, and can't be
// edited; `remove` sets `deletedAt`, so linked entries can still show the
// provider's name. Writes go through providerService, which validates content.
export const { get, getById, list, create, update, remove } = softDeleteFunctions({
  schemaName,
  dbToModel,
  defaultOrder: DISPLAY_ORDER,
});

/**
 * Lock a live provider's row for the rest of `tx` and return it, or null if
 * it's gone or deleted. Internal: no permission scope, so callers check
 * visibility (or the group) themselves.
 *
 * - `update` (deleting a practice) waits for, and blocks, `share`.
 * - `share` (a provider naming it as their practice) blocks the delete, and
 *   after waiting for one, rereads the row and sees it deleted.
 */
export const lockLive = async (id: string, tx: Tx, strength: "update" | "share") => {
  const t = providerSchema;
  const rows = await dbMayFail(
    () =>
      tx
        .select()
        .from(t)
        .where(and(eq(t.id, id), isNull(t.deletedAt)))
        .for(strength),
    "providerModel:lock",
  );
  if (isError(rows)) return rows;
  return rows[0] ?? null;
};
