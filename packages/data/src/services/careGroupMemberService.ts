import type { GroupRoleName } from "../constants";
import type { CareGroupMemberInsert, Tx } from "../db";
import type { ServiceContext } from "./types";

import { GROUP_MANAGER_ROLES } from "../constants";
import { withTransaction } from "../db";
import { isError, newError } from "../errors";
import { careGroupMemberModel } from "../models";
import { isSystemUser } from "../permissions";
import { getService } from "./baseService";
import { removeForMember as removeCalendarSettings } from "./calendarSettingService";
import { revokeForMember } from "./connectorGrantService";
import { disconnectForMember as disconnectGoogle } from "./googleConnectionService";
import { releaseAssignee } from "./todoService";

export const schemaName = careGroupMemberModel.schemaName;

// Reads come straight from the model (RBAC: any member of the group).
// Writes add rules the permissions map can't express:
//   - only owners add, promote to, demote from, or remove owners
//   - a group always keeps at least one owner
//   - a member who goes keeps their open todos as a typed-in name
//   - a member who goes loses their assistants' connections to the group
//   - a member who goes loses their calendar settings, feed and reminder overrides there
export const { get, getById, list } = getService(careGroupMemberModel);

/** Whether the actor may touch owner memberships in `groupId`. */
const actorIsOwner = async (ctx: ServiceContext, groupId: string, tx: Tx) => {
  if (isSystemUser(ctx.authUser)) return true;
  if (!ctx.authUser) return false;
  const role = await careGroupMemberModel.getRole(groupId, ctx.authUser.id, { tx });
  if (isError(role)) return role;
  return role === "owner";
};

/** Fails when removing one owner from `groupId` would leave it with none. */
const ensureAnotherOwner = async (groupId: string, tx: Tx) => {
  const owners = await careGroupMemberModel.lockOwners(groupId, tx);
  if (isError(owners)) return owners;
  return owners > 1 ? null : newError({ code: "careGroupMemberService:lastOwner" });
};

/** Load a membership the actor can see, inside `tx`. */
const getTarget = async (ctx: ServiceContext, id: string, tx: Tx) => {
  const target = await careGroupMemberModel.getById(id, { ...ctx, tx });
  if (isError(target)) return target;
  return target ?? newError({ code: "careGroupMemberService:notFound" });
};

/**
 * Add a user to a group directly. Normal sign-ups come through invites;
 * this is for staff tools, tests and accepting an invite.
 */
export const create = (ctx: ServiceContext, data: CareGroupMemberInsert) =>
  withTransaction(async (tx) => {
    if (data.role === "owner") {
      const isOwner = await actorIsOwner(ctx, data.groupId, tx);
      if (isError(isOwner)) return isOwner;
      if (!isOwner) return newError({ code: "careGroupMemberService:ownerOnly" });
    }
    return careGroupMemberModel.create({ ...ctx, tx, data });
  }, ctx);

/** Change a member's group role. */
export const updateRole = (ctx: ServiceContext, { id, role }: { id: string; role: GroupRoleName }) =>
  withTransaction(async (tx) => {
    const target = await getTarget(ctx, id, tx);
    if (isError(target)) return target;
    if (target.role === role) return target;

    if (target.role === "owner" || role === "owner") {
      const isOwner = await actorIsOwner(ctx, target.groupId, tx);
      if (isError(isOwner)) return isOwner;
      if (!isOwner) return newError({ code: "careGroupMemberService:ownerOnly" });
    }

    if (target.role === "owner") {
      const lastOwner = await ensureAnotherOwner(target.groupId, tx);
      if (lastOwner) return lastOwner;
    }

    const updated = await careGroupMemberModel.update({
      ...ctx,
      tx,
      filter: { id: { type: "eq", value: id } },
      data: { role },
    });
    if (isError(updated)) return updated;
    return updated[0] ?? newError({ code: "careGroupMemberService:notFound" });
  }, ctx);

/** Remove a member. Owners can only be removed by an owner (or themselves). */
export const remove = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const target = await getTarget(ctx, id, tx);
    if (isError(target)) return target;

    if (target.role === "owner") {
      const isSelf = target.userId === ctx.authUser?.id;
      if (!isSelf) {
        const isOwner = await actorIsOwner(ctx, target.groupId, tx);
        if (isError(isOwner)) return isOwner;
        if (!isOwner) return newError({ code: "careGroupMemberService:ownerOnly" });
      }
      const lastOwner = await ensureAnotherOwner(target.groupId, tx);
      if (lastOwner) return lastOwner;
    }

    const removed = await careGroupMemberModel.remove({
      ...ctx,
      tx,
      filter: { id: { type: "eq", value: id } },
    });
    if (isError(removed)) return removed;
    // Their open todos keep their name as a typed-in assignee (todos PRD).
    const released = await releaseAssignee(tx, target.groupId, target.userId);
    if (isError(released)) return released;
    // Their AI assistants' access to the group ends with the membership (connectors PRD).
    const disconnected = await revokeForMember(tx, target.groupId, target.userId);
    if (disconnected) return disconnected;
    // Their reminders, feed and details consent end with it too (appointments-2).
    const forgotten = await removeCalendarSettings(tx, target.groupId, target.userId);
    if (forgotten) return forgotten;
    // And their Google calendar stops updating (revoked after commit; the calendar stays in Google).
    const unsynced = await disconnectGoogle(tx, target.groupId, target.userId);
    if (unsynced) return unsynced;
    return removed;
  }, ctx);

/** The actor leaves `groupId`. The last owner must hand over ownership first. */
export const leave = async (ctx: ServiceContext, groupId: string) => {
  if (!ctx.authUser) return newError({ code: "permissions:unauthenticated" });
  const membership = await careGroupMemberModel.get({
    ...ctx,
    filter: { groupId: { type: "eq", value: groupId }, userId: { type: "eq", value: ctx.authUser.id } },
  });
  if (isError(membership)) return membership;
  if (!membership) return newError({ code: "careGroupMemberService:notFound" });
  return remove(ctx, membership.id);
};

/**
 * Whether each member of `groupId` has confirmed their email, and when they
 * last signed in (their latest remaining session; null when none is left).
 * Owners and admins only: a non-member gets `notFound`, any other member
 * `managersOnly`. The model scopes the rows in SQL too. Never the email.
 */
export const accountStatuses = async (ctx: ServiceContext, groupId: string) => {
  if (isSystemUser(ctx.authUser)) return careGroupMemberModel.accountStatuses(groupId, null);
  if (!ctx.authUser) return newError({ code: "permissions:unauthenticated" });
  const role = await careGroupMemberModel.getRole(groupId, ctx.authUser.id);
  if (isError(role)) return role;
  if (!role) return newError({ code: "careGroupMemberService:notFound" });
  if (!GROUP_MANAGER_ROLES.some((managerRole) => managerRole === role))
    return newError({ code: "careGroupMemberService:managersOnly" });
  return careGroupMemberModel.accountStatuses(groupId, ctx.authUser.id);
};
