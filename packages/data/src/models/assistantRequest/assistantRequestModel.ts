import type { AssistantRequest, Tx } from "../../db";

import { and, eq } from "drizzle-orm";
import { dbMayFail } from "../../db";
import { careGroupMemberSchema } from "../../db/schema";
import { isError } from "../../errors";
import * as baseModel from "../base";

export const schemaName = "assistantRequestSchema";

export const dbToModel = (row: AssistantRequest) => row;

const base = baseModel.getFunctions({ schemaName, dbToModel });

// Written only by the system (assistantRequestService).
export const { create, get, getById, list } = base;

/**
 * Lock `userId`'s membership of `groupId` `FOR UPDATE` and return its role
 * (null for a non-member), so two asks at once run one after the other and
 * only one emails. Unscoped: the service asks for the actor's own row.
 */
export const lockMembership = async (groupId: string, userId: string, tx: Tx) => {
  const res = await dbMayFail(
    () =>
      tx
        .select({ role: careGroupMemberSchema.role })
        .from(careGroupMemberSchema)
        .where(and(eq(careGroupMemberSchema.groupId, groupId), eq(careGroupMemberSchema.userId, userId)))
        .limit(1)
        .for("update"),
    "assistantRequestModel:lockMembership",
  );
  if (isError(res)) return res;
  return res[0]?.role ?? null;
};
