import type { SymptomType, Tx } from "../../db";
import type { QuerySelectArgs } from "../base/queryHelpers";

import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { dbMayFail, txOrDb } from "../../db";
import { symptomTypeSchema } from "../../db/schema";
import { isError } from "../../errors";
import * as baseModel from "../base";

export const schemaName = "symptomTypeSchema";
type K = typeof schemaName;

export const dbToModel = (row: SymptomType) => row;

const base = baseModel.getFunctions({ schemaName, dbToModel });

/** By name, A to Z. */
export const NAME_ORDER = [
  { field: "nameKey", direction: "asc" },
  { field: "id", direction: "asc" },
] as const satisfies QuerySelectArgs<K>["orderBy"];

export const { get, getById } = base;

export const list = (args: QuerySelectArgs<K>) =>
  base.list({ ...args, orderBy: args.orderBy ?? [...NAME_ORDER] });

// Write through symptomTypeService, which derives the id and the key on
// create and checks the actor's group role before `setArchived`. Rows are
// never removed (but with their group).
export const { create } = base;

/**
 * Archive (`archived: true`) or bring back one of a group's rows, as
 * `actorId`: past the permission map, where updates are system-only, so the
 * caller checks the role. Only an active row is archived and only an
 * archived one brought back, and never a tombstone, so a repeat changes
 * nothing (`updated_at` included). Returns whether the row changed.
 */
export const setArchived = async (
  { groupId, id, archived }: { groupId: string; id: string; archived: boolean },
  { actorId, tx }: { actorId: string; tx?: Tx },
) => {
  const t = symptomTypeSchema;
  const res = await dbMayFail(
    () =>
      txOrDb(tx)
        .update(t)
        .set({ archivedAt: archived ? sql`now()` : null, updatedBy: actorId })
        .where(
          and(
            eq(t.groupId, groupId),
            eq(t.id, id),
            isNull(t.replacedById),
            archived ? isNull(t.archivedAt) : isNotNull(t.archivedAt),
          ),
        )
        .returning({ id: t.id }),
    "baseModel:update",
    { schemaName },
  );
  return isError(res) ? res : res.length > 0;
};
