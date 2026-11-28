import type { Tx } from "../db";

import { and, count, eq, inArray } from "drizzle-orm";
import { OWNER_ROLES } from "../constants";
import { dbMayFail } from "../db";
import { careGroupMemberSchema, careGroupSchema, userSchema } from "../db/schema";
import { isError, newError } from "../errors";
import { getSetting } from "./appSettingService";

// The free plan's cap on starting care groups (free-limits PRD). One rule,
// one place: this service owns the count, the limit and the refusal, and
// `careGroupService.create` only calls `refusal`. What counts is a group the
// user started (`created_by`) and still owns; groups they were invited to,
// made owner of, or that staff or an access code started (the system or
// staff as creator) don't.

/**
 * `groupLimitService:atLimit` when `userId` has started as many groups as
 * they may (`limits.groupsStarted`), else null. Inside the caller's
 * transaction: the user's row is locked `FOR UPDATE` first, so two creates
 * at once queue up and can't both take the last slot.
 */
export const refusal = async (tx: Tx, userId: string) => {
  const locked = await dbMayFail(
    () => tx.select({ id: userSchema.id }).from(userSchema).where(eq(userSchema.id, userId)).for("update"),
    "db:transaction",
  );
  if (isError(locked)) return locked;

  const started = await startedCount(tx, userId);
  if (isError(started)) return started;
  const limit = await getSetting("limits.groupsStarted");
  return started >= limit ? newError({ code: "groupLimitService:atLimit" }) : null;
};

/** How many groups `userId` started and is still an owner of. */
const startedCount = async (tx: Tx, userId: string) => {
  const rows = await dbMayFail(
    () =>
      tx
        .select({ n: count() })
        .from(careGroupSchema)
        .innerJoin(
          careGroupMemberSchema,
          and(
            eq(careGroupMemberSchema.groupId, careGroupSchema.id),
            eq(careGroupMemberSchema.userId, userId),
            inArray(careGroupMemberSchema.role, OWNER_ROLES),
          ),
        )
        .where(eq(careGroupSchema.createdBy, userId)),
    "db:transaction",
  );
  if (isError(rows)) return rows;
  return rows[0]?.n ?? 0;
};
