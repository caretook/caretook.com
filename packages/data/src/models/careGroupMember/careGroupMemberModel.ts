import type { CareGroupMember, Tx } from "../../db";

import { and, eq, exists, inArray, max, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { GROUP_MANAGER_ROLES } from "../../constants";
import { dbMayFail, txOrDb } from "../../db";
import { careGroupMemberSchema, sessionSchema, userSchema } from "../../db/schema";
import { isError } from "../../errors";
import * as baseModel from "../base";

export const schemaName = "careGroupMemberSchema";

export const dbToModel = (row: CareGroupMember) => row;

const base = baseModel.getFunctions({ schemaName, dbToModel });

// Writes go through careGroupMemberService, which adds the owner rules.
export const { create, get, getById, list, remove, update, upsert } = base;

// ---------------------------------------------------------------------------
// Unscoped helpers for services. They skip RBAC, so services must only use
// them for facts the actor is entitled to (their own role, owner counts
// inside a scoped operation), never to return rows to the caller.
// ---------------------------------------------------------------------------

/** `userId`'s role in `groupId`, or null when they aren't a member. */
export const getRole = async (groupId: string, userId: string, opts: { tx?: Tx } = {}) => {
  const res = await dbMayFail(
    () =>
      txOrDb(opts.tx)
        .select({ role: careGroupMemberSchema.role })
        .from(careGroupMemberSchema)
        .where(and(eq(careGroupMemberSchema.groupId, groupId), eq(careGroupMemberSchema.userId, userId)))
        .limit(1),
    "careGroupMemberModel:getRole",
  );
  if (isError(res)) return res;
  return res[0]?.role ?? null;
};

/**
 * Lock the group's owner rows and return how many there are. Call inside a
 * transaction before demoting or removing an owner, so two concurrent
 * changes can't both remove "one of two" owners.
 */
export const lockOwners = async (groupId: string, tx: Tx) => {
  const res = await dbMayFail(
    () =>
      tx
        .select({ id: careGroupMemberSchema.id })
        .from(careGroupMemberSchema)
        .where(and(eq(careGroupMemberSchema.groupId, groupId), eq(careGroupMemberSchema.role, "owner")))
        .for("update"),
    "careGroupMemberModel:lockOwners",
  );
  if (isError(res)) return res;
  return res.length;
};

/**
 * Insert the first owner of a newly created group. This bypasses RBAC (no
 * one can manage the group yet), so only careGroupModel.create calls it, in
 * the same transaction as the group insert.
 */
export const insertFirstOwner = async (args: { groupId: string; userId: string; actorId: string; tx: Tx }) =>
  dbMayFail(
    () =>
      args.tx.insert(careGroupMemberSchema).values({
        groupId: args.groupId,
        userId: args.userId,
        role: "owner",
        createdBy: args.actorId,
        updatedBy: args.actorId,
      }),
    "careGroupMemberModel:insertFirstOwner",
  );

/**
 * Lock every membership in `groupId` and return them. For services that
 * rewrite the emergency list (ranks, the primary contact), inside the
 * transaction that changes it, after they've checked the actor's role.
 */
export const lockGroupMembers = async (groupId: string, tx: Tx) =>
  dbMayFail(
    () =>
      tx
        .select()
        .from(careGroupMemberSchema)
        .where(eq(careGroupMemberSchema.groupId, groupId))
        .orderBy(careGroupMemberSchema.createdAt)
        .for("update"),
    "careGroupMemberModel:lockGroupMembers",
  );

/** Every membership of `userId`. Unscoped: for keeping their own shares in step. */
export const listForUser = async (userId: string, tx: Tx) =>
  dbMayFail(
    () => tx.select().from(careGroupMemberSchema).where(eq(careGroupMemberSchema.userId, userId)),
    "careGroupMemberModel:listForUser",
  );

const manager = alias(careGroupMemberSchema, "status_manager");

/**
 * Each member of `groupId` with whether their account's email is confirmed
 * and when their latest remaining session started (null when none is left).
 * Scoped in SQL: only an owner or admin of the group (`actorId`) gets rows;
 * `actorId` null is the system, which sees every group. Never the email.
 */
export const accountStatuses = async (groupId: string, actorId: string | null, opts: { tx?: Tx } = {}) => {
  const m = careGroupMemberSchema;
  const db = txOrDb(opts.tx);
  const actorManages =
    actorId === null
      ? undefined
      : exists(
          db
            .select({ one: sql`1` })
            .from(manager)
            .where(
              and(
                eq(manager.groupId, m.groupId),
                eq(manager.userId, actorId),
                inArray(manager.role, [...GROUP_MANAGER_ROLES]),
              ),
            ),
        );
  return dbMayFail(
    () =>
      db
        .select({
          userId: m.userId,
          emailVerified: userSchema.emailVerified,
          lastSignInAt: max(sessionSchema.createdAt),
        })
        .from(m)
        .innerJoin(userSchema, eq(userSchema.id, m.userId))
        .leftJoin(sessionSchema, eq(sessionSchema.userId, m.userId))
        .where(and(eq(m.groupId, groupId), actorManages))
        .groupBy(m.userId, userSchema.emailVerified),
    "careGroupMemberModel:accountStatuses",
  );
};
