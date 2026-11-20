import type { GroupRoleName } from "../constants";
import type { Tx } from "../db";
import type { StaffSettableGroupRole } from "../db/schema";
import type { GroupDirectoryFilter } from "../models";
import type { InviteMailer } from "./careGroupInviteService";
import type { ServiceContext } from "./types";

import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import {
  auditChanges,
  GROUP_ADMIN_PAGE_SIZE,
  inviteEmailZ,
  STAFF_SETTABLE_GROUP_ROLES,
  staffReasonZSchema,
} from "../db/schema";
import { isError, newError } from "../errors";
import { careGroupInviteModel, careGroupMemberModel, groupDirectoryModel } from "../models";
import * as adminAuditService from "./adminAuditService";
import * as careGroupInviteService from "./careGroupInviteService";
import * as careGroupMemberService from "./careGroupMemberService";
import { auditActorId, staffRefusal } from "./staffAccess";

export const serviceName = "groupAdmin";
export const schemaName = groupDirectoryModel.schemaName;

// Care groups for Caretook staff (admin slice 4). Reads (`groups.read`,
// admin and support) give names, members, counts and dates, never care data.
// Writes (`groups.manage`, admins only) recover an owner, change a role or
// remove a member: each runs as the system after the capability check,
// through careGroupMemberService's rules (a group always keeps an owner), and
// records one audit entry with the staff member's reason in the same
// transaction. A refused change records nothing.

const ROLE_FIELDS = ["role"] as const;

/** The trimmed reason, or `groupAdminService:invalid`. */
const reasonOf = (reason: string) => {
  const parsed = staffReasonZSchema.safeParse(reason);
  return parsed.success
    ? parsed.data
    : newError({ code: "groupAdminService:invalid", meta: { field: "reason" } });
};

/** Staff (`groups.read`): one page of groups matching `filter`, newest first, and how many match. */
export const search = async (
  ctx: ServiceContext,
  filter: GroupDirectoryFilter,
  page: { page: number; limit?: number },
) => {
  const refused = staffRefusal(ctx, "groups.read");
  if (refused) return refused;
  const limit = Math.min(Math.max(page.limit ?? GROUP_ADMIN_PAGE_SIZE, 1), GROUP_ADMIN_PAGE_SIZE);
  const offset = (Math.max(Math.trunc(page.page) || 1, 1) - 1) * limit;
  return groupDirectoryModel.search({ tx: ctx.tx, filter, page: { limit, offset } });
};

/**
 * Staff (`groups.read`): the group's name, recipient's name, members (with
 * who invited them and when they joined), counts and dates; null when
 * there's no such group. Records `group.view` in the background.
 */
export const get = async (ctx: ServiceContext, groupId: string) => {
  const refused = staffRefusal(ctx, "groups.read");
  if (refused) return refused;
  const group = await groupDirectoryModel.getGroup(groupId, ctx.tx);
  if (isError(group) || !group) return group;
  const members = await groupDirectoryModel.members(groupId, ctx.tx);
  if (isError(members)) return members;
  const activity = await groupDirectoryModel.activity(groupId, ctx.tx);
  if (isError(activity)) return activity;

  adminAuditService.recordSoon({ actorId: auditActorId(ctx), action: "group.view", targetGroupId: groupId });
  return { ...group, members, ...activity };
};

/** The membership of `userId` in `groupId`, read as the system inside `tx`. */
const membershipOf = async (groupId: string, userId: string, tx: Tx) => {
  const group = await groupDirectoryModel.getGroup(groupId, tx);
  if (isError(group)) return group;
  if (!group) return newError({ code: "groupAdminService:notFound" });
  const membership = await careGroupMemberModel.get({
    authUser: SYSTEM_USER,
    tx,
    filter: { groupId: { type: "eq", value: groupId }, userId: { type: "eq", value: userId } },
  });
  if (isError(membership)) return membership;
  return membership ?? newError({ code: "groupAdminService:notMember" });
};

/** Give a member a new role, as the system, and record it as `action`. */
const setRole = (
  ctx: ServiceContext,
  input: { groupId: string; userId: string; role: GroupRoleName; reason: string },
  action: "group.promoteOwner" | "group.changeRole",
) =>
  withTransaction(async (tx) => {
    const refused = staffRefusal(ctx, "groups.manage");
    if (refused) return refused;
    const reason = reasonOf(input.reason);
    if (isError(reason)) return reason;
    const membership = await membershipOf(input.groupId, input.userId, tx);
    if (isError(membership)) return membership;
    if (membership.role === input.role) return newError({ code: "groupAdminService:unchanged" });

    // Through the member service: it locks the owners and refuses demoting the last one.
    const updated = await careGroupMemberService.updateRole(
      { authUser: SYSTEM_USER, tx },
      { id: membership.id, role: input.role },
    );
    if (isError(updated)) return updated;

    const recorded = await adminAuditService.record(tx, {
      actorId: auditActorId(ctx),
      action,
      targetUserId: input.userId,
      targetGroupId: input.groupId,
      reason,
      changes: auditChanges({ role: membership.role }, { role: updated.role }, ROLE_FIELDS),
    });
    if (isError(recorded)) return recorded;
    return { groupId: input.groupId, userId: input.userId, role: updated.role };
  }, ctx);

/** Admins (`groups.manage`): make a member an owner (owner recovery). `invited_by` stays as it was. */
export const promoteOwner = (
  ctx: ServiceContext,
  input: { groupId: string; userId: string; reason: string },
) => setRole(ctx, { ...input, role: "owner" }, "group.promoteOwner");

/**
 * Admins (`groups.manage`): change a member's role to admin, caretaker or
 * viewer. Demoting the last owner is refused (`careGroupMemberService:lastOwner`).
 */
export const changeRole = (
  ctx: ServiceContext,
  input: { groupId: string; userId: string; role: StaffSettableGroupRole; reason: string },
) => {
  if (!STAFF_SETTABLE_GROUP_ROLES.some((role) => role === input.role))
    return Promise.resolve(newError({ code: "groupAdminService:invalid", meta: { field: "role" } }));
  return setRole(ctx, input, "group.changeRole");
};

/** Admins (`groups.manage`): remove a member. Removing the last owner is refused. */
export const removeMember = (
  ctx: ServiceContext,
  input: { groupId: string; userId: string; reason: string },
) =>
  withTransaction(async (tx) => {
    const refused = staffRefusal(ctx, "groups.manage");
    if (refused) return refused;
    const reason = reasonOf(input.reason);
    if (isError(reason)) return reason;
    const membership = await membershipOf(input.groupId, input.userId, tx);
    if (isError(membership)) return membership;

    const removed = await careGroupMemberService.remove({ authUser: SYSTEM_USER, tx }, membership.id);
    if (isError(removed)) return removed;

    const recorded = await adminAuditService.record(tx, {
      actorId: auditActorId(ctx),
      action: "group.removeMember",
      targetUserId: input.userId,
      targetGroupId: input.groupId,
      reason,
      changes: auditChanges({ role: membership.role }, null, ROLE_FIELDS),
    });
    if (isError(recorded)) return recorded;
    return { groupId: input.groupId, userId: input.userId };
  }, ctx);

/**
 * Admins (`groups.manage`): send an owner invite to `email` (the
 * `ownerInvite` email through `opts.mail`), as the system with the staff
 * member as the one who attested, as a staff-made group's invite is. The
 * invite rules apply: not a current member, not a second waiting invite.
 * Returns the outbox row to deliver after commit.
 */
export const inviteOwner = (
  ctx: ServiceContext,
  input: { groupId: string; email: string; reason: string },
  opts: { mail?: InviteMailer } = {},
) =>
  withTransaction(async (tx) => {
    const refused = staffRefusal(ctx, "groups.manage");
    if (refused) return refused;
    const reason = reasonOf(input.reason);
    if (isError(reason)) return reason;
    const email = inviteEmailZ.safeParse(input.email.trim());
    if (!email.success) return newError({ code: "groupAdminService:invalid", meta: { field: "email" } });
    const group = await groupDirectoryModel.getGroup(input.groupId, tx);
    if (isError(group)) return group;
    if (!group) return newError({ code: "groupAdminService:notFound" });

    const system = { authUser: SYSTEM_USER, tx };
    const sent = await careGroupInviteService.createEmail(
      system,
      { groupId: input.groupId, email: email.data, role: "owner", attested: true },
      { ...opts, staffInvite: true },
    );
    if (isError(sent)) return sent;

    const actorId = auditActorId(ctx);
    if (actorId) {
      const attested = await careGroupInviteModel.update({
        ...system,
        filter: { id: { type: "eq", value: sent.invite.id } },
        data: { consentAttestedBy: actorId },
      });
      if (isError(attested)) return attested;
    }

    const recorded = await adminAuditService.record(tx, {
      actorId,
      action: "group.inviteOwner",
      targetGroupId: input.groupId,
      reason,
      changes: auditChanges(null, { email: sent.invite.email, role: "owner" }, ["email", "role"]),
    });
    if (isError(recorded)) return recorded;
    return { inviteId: sent.invite.id, email: sent.invite.email, queued: sent.queued };
  }, ctx);
