import type { CareRecipientDetails, Tx } from "../../db";

import { eq } from "drizzle-orm";
import { dbMayFail } from "../../db";
import { careRecipientDetailsSchema } from "../../db/schema";
import { isError } from "../../errors";
import * as baseModel from "../base";

export const schemaName = "careRecipientDetailsSchema";

export const dbToModel = (row: CareRecipientDetails) => row;

// Writes go through careRecipientDetailsService and emergencyContactService.
export const { create, get, getById, list, remove, update, upsert } = baseModel.getFunctions({
  schemaName,
  dbToModel,
});

/**
 * Lock the group's details row, if it has one. Unscoped: only for services
 * that have already checked the actor's role, inside the transaction that
 * rewrites its outside contacts or their emergency ranks.
 */
export const lockForGroup = async (groupId: string, tx: Tx) => {
  const res = await dbMayFail(
    () =>
      tx
        .select()
        .from(careRecipientDetailsSchema)
        .where(eq(careRecipientDetailsSchema.groupId, groupId))
        .for("update"),
    "careRecipientDetailsModel:lockForGroup",
  );
  if (isError(res)) return res;
  return res[0] ?? null;
};
