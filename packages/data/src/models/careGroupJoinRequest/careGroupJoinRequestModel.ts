import type { CareGroupJoinRequest, Tx } from "../../db";

import { eq } from "drizzle-orm";
import { dbMayFail } from "../../db";
import { careGroupJoinRequestSchema } from "../../db/schema";
import { isError } from "../../errors";
import * as baseModel from "../base";

export const schemaName = "careGroupJoinRequestSchema";

export const dbToModel = (row: CareGroupJoinRequest) => row;

const base = baseModel.getFunctions({ schemaName, dbToModel });

// Written only by the system (joinRequestService, careGroupInviteService.accept).
export const { create, get, getById, list, update } = base;

/**
 * Lock request `id` `FOR UPDATE` inside a transaction and return it, so two
 * answers to one request run one after the other. Unscoped: the service has
 * checked the actor first.
 */
export const lock = async (id: string, tx: Tx) => {
  const res = await dbMayFail(
    () =>
      tx
        .select()
        .from(careGroupJoinRequestSchema)
        .where(eq(careGroupJoinRequestSchema.id, id))
        .limit(1)
        .for("update"),
    "careGroupJoinRequestModel:lock",
  );
  if (isError(res)) return res;
  const [row] = res;
  return row ? dbToModel(row) : null;
};
