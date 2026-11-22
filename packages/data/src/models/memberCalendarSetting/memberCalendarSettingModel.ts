import type { MemberCalendarSetting, Tx } from "../../db";

import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { dbMayFail, txOrDb } from "../../db";
import { memberCalendarSettingSchema, reminderOverrideSchema } from "../../db/schema";
import { isError } from "../../errors";
import * as baseModel from "../base";

export const schemaName = "memberCalendarSettingSchema";

/** A feed token's stored form: its SHA-256 (hex). The token itself is never stored. */
export const hashFeedToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const dbToModel = (row: MemberCalendarSetting) => row;

// Reads and writes go through calendarSettingService (the member's own row only).
export const { create, get, getById, list, update } = baseModel.getFunctions({ schemaName, dbToModel });

/**
 * A member leaving or removed from `groupId`: their calendar settings (and
 * so their feed) and reminder overrides there are deleted, inside the
 * removal's transaction. System work: callers have checked the removal.
 */
export const removeForMember = async (tx: Tx, groupId: string, userId: string) => {
  const db = txOrDb(tx);
  const done = await dbMayFail(async () => {
    await db
      .delete(reminderOverrideSchema)
      .where(and(eq(reminderOverrideSchema.groupId, groupId), eq(reminderOverrideSchema.userId, userId)));
    await db
      .delete(memberCalendarSettingSchema)
      .where(
        and(eq(memberCalendarSettingSchema.groupId, groupId), eq(memberCalendarSettingSchema.userId, userId)),
      );
    return true;
  }, "memberCalendarSettingModel:removeForMember");
  return isError(done) ? done : null;
};
