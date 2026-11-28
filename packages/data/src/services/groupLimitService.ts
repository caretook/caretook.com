import type { Tx } from "../db";
import type { SetGroupLimitInput } from "../db/schema";
import type { ServiceContext } from "./types";

import { and, count, eq, inArray } from "drizzle-orm";
import { OWNER_ROLES, SYSTEM_USER } from "../constants";
import { dbMayFail, withTransaction } from "../db";
import {
  auditChanges,
  careGroupMemberSchema,
  careGroupSchema,
  setGroupLimitZSchema,
  userSchema,
} from "../db/schema";
import { isError, newError } from "../errors";
import * as adminAuditService from "./adminAuditService";
import { getSetting } from "./appSettingService";
import { auditActorId, staffRefusal } from "./staffAccess";

// The free plan's cap on starting care groups (free-limits PRD). One rule,
// one place: this service owns the count, the limit and the refusal, and
// `careGroupService.create` only calls `defaultLimit` and `refusal`; staff
// read and change one account's limit through `forUser` and `setForUser`. What counts is a group the
// user started (`created_by`) and still owns; groups they were invited to,
// made owner of, or that staff or an access code started (the system or
// staff as creator) don't.

/**
 * The setting's cap (`limits.groupsStarted`), for `refusal`. Read before the
 * caller's transaction opens (B-1036): a cold settings cache reads through
 * its own pool connection, which mustn't wait while the user's row is locked.
 */
export const defaultLimit = () => getSetting("limits.groupsStarted");

/**
 * `groupLimitService:atLimit` when `userId` has started as many groups as
 * they may, else null. Their limit is their own `group_limit` when set, else
 * `fallback` (the setting, from `defaultLimit`, read before the transaction).
 * Inside the caller's transaction, and only on it: the user's row is locked
 * `FOR UPDATE` first, so two creates at once queue up and can't both take the
 * last slot.
 */
export const refusal = async (tx: Tx, userId: string, fallback: number) => {
  const locked = await dbMayFail(
    () =>
      tx
        .select({ groupLimit: userSchema.groupLimit })
        .from(userSchema)
        .where(eq(userSchema.id, userId))
        .for("update"),
    "db:transaction",
  );
  if (isError(locked)) return locked;

  const started = await startedCount(tx, userId);
  if (isError(started)) return started;
  const limit = locked[0]?.groupLimit ?? fallback;
  return started >= limit ? newError({ code: "groupLimitService:atLimit" }) : null;
};

/** What staff see: how many groups the account started, its limit, and its own override (null: the default). */
export type GroupLimitView = { started: number; limit: number; override: number | null };

/** The account's own `group_limit`, its row locked when `lock`; `accountAdmin:notFound` when there's no such account. */
const overrideOf = async (tx: Tx, userId: string, lock: boolean) => {
  const rows = await dbMayFail(() => {
    const q = tx
      .select({ groupLimit: userSchema.groupLimit })
      .from(userSchema)
      .where(eq(userSchema.id, userId));
    return lock ? q.for("update") : q;
  }, "db:transaction");
  if (isError(rows)) return rows;
  const row = rows[0];
  return row ? row.groupLimit : newError({ code: "accountAdmin:notFound" });
};

const viewOf = async (tx: Tx, userId: string, override: number | null, fallback: number) => {
  const started = await startedCount(tx, userId);
  if (isError(started)) return started;
  return { started, limit: override ?? fallback, override } satisfies GroupLimitView;
};

/**
 * Staff (`users.read`): how many groups `userId` started and still owns,
 * their limit, and their own override (null when the default applies).
 */
export const forUser = async (ctx: ServiceContext, userId: string) => {
  const refused = staffRefusal(ctx, "users.read");
  if (refused) return refused;
  const fallback = await defaultLimit();
  return withTransaction(async (tx) => {
    const override = await overrideOf(tx, userId, false);
    if (isError(override)) return override;
    return viewOf(tx, userId, override, fallback);
  }, ctx);
};

/**
 * Staff (`users.limits`): set one account's own limit (1 to 1000), or null
 * to go back to the default, with why. One transaction: the row locked,
 * the column written as the system (no member writes it), and
 * `user.setGroupLimit` recorded with `{ groupLimit: [before, after] }`. The
 * value it already has records nothing. Returns what `forUser` does.
 */
export const setForUser = async (ctx: ServiceContext, input: SetGroupLimitInput) => {
  const refused = staffRefusal(ctx, "users.limits");
  if (refused) return refused;
  const parsed = setGroupLimitZSchema.safeParse(input);
  if (!parsed.success)
    return newError({
      code: "accountAdmin:invalid",
      meta: {
        issues: parsed.error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message })),
      },
    });
  const { userId, limit, reason } = parsed.data;
  const fallback = await defaultLimit();
  return withTransaction(async (tx) => {
    const before = await overrideOf(tx, userId, true);
    if (isError(before)) return before;
    const changes = auditChanges({ groupLimit: before }, { groupLimit: limit }, ["groupLimit"]);
    if (!Object.keys(changes).length) return viewOf(tx, userId, before, fallback);

    const updated = await dbMayFail(
      () =>
        tx
          .update(userSchema)
          .set({ groupLimit: limit, updatedBy: ctx.authUser?.id ?? SYSTEM_USER.id })
          .where(eq(userSchema.id, userId)),
      "db:transaction",
    );
    if (isError(updated)) return updated;
    const recorded = await adminAuditService.record(tx, {
      actorId: auditActorId(ctx),
      action: "user.setGroupLimit",
      targetUserId: userId,
      reason,
      changes,
    });
    if (isError(recorded)) return recorded;
    return viewOf(tx, userId, limit, fallback);
  }, ctx);
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
