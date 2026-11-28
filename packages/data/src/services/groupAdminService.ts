import type { GroupRoleName } from "../constants";
import type { Tx } from "../db";
import type { AppError } from "../errors";
import type { GroupDirectoryFilter } from "../models";
import type { InviteMailer } from "./careGroupInviteService";
import type { ServiceContext } from "./types";

import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import { auditChanges, inviteEmailZ, staffReasonZSchema } from "../db/schema";
import { isError, newError } from "../errors";
import { careGroupInviteModel, careGroupMemberModel, groupDirectoryModel, userModel } from "../models";
import * as adminAuditService from "./adminAuditService";
import * as careGroupInviteService from "./careGroupInviteService";
import * as careGroupMemberService from "./careGroupMemberService";
import { groupDisplayName } from "./groupNames";
import { auditActorId, staffRefusal } from "./staffAccess";
import type { StaffSettableGroupRole } from "../domain/admin/groupAdminRules";
import { GROUP_ADMIN_PAGE_SIZE, STAFF_SETTABLE_GROUP_ROLES } from "../domain/admin/groupAdminRules";

export const schemaName = groupDirectoryModel.schemaName;

// Care groups for Caretook staff (admin slice 4). Reads (`groups.read`,
// admin and support) give names, members, counts and dates, never care data.
// Writes (`groups.manage`, admins only) recover an owner, change a role or
// remove a member: each runs as the system after the capability check,
// through careGroupMemberService's rules (a group always keeps an owner), and
// records one audit entry with the staff member's reason in the same
// transaction. A refused change records nothing. Every change also queues a
// `staffGroupChange` email to the group's owners through an injected
// `StaffGroupMailer`, in the same transaction (account-security slice 3).

const ROLE_FIELDS = ["role"] as const;

/** What staff changed, as the owners' email tells it: names and roles, never the staff member. */
export type StaffGroupChange =
  | { kind: "ownerInvited"; email: string }
  | { kind: "madeOwner"; memberName: string; from: GroupRoleName }
  | { kind: "roleChanged"; memberName: string; from: GroupRoleName; to: GroupRoleName }
  | { kind: "removed"; memberName: string; from: GroupRoleName };

export type StaffGroupNotice = {
  groupId: string;
  groupName: string;
  change: StaffGroupChange;
  /** The audit entry the change recorded (one email per entry and owner). */
  auditId: string;
  /** The group's owners: those after the change, and an owner it demoted or removed. */
  to: { userId: string; email: string }[];
};

/**
 * Queues the owners' `staffGroupChange` emails in the service's transaction
 * (the API passes one that calls notify with `tx`). Returns the outbox ids,
 * to deliver after commit.
 */
export type StaffGroupMailer = (notice: StaffGroupNotice, tx: Tx) => Promise<string[] | AppError>;

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

/** The group's owners' ids and addresses, plus `extraUserIds` (read as the system). */
const ownersOf = async (groupId: string, tx: Tx, extraUserIds: string[] = []) => {
  const owners = await careGroupMemberModel.list({
    authUser: SYSTEM_USER,
    tx,
    filter: { groupId: { type: "eq", value: groupId }, role: { type: "eq", value: "owner" } },
    paginate: { page: 1, limit: 100 },
  });
  if (isError(owners)) return owners;
  const ids = [...new Set([...owners.data.map((m) => m.userId), ...extraUserIds])];
  if (!ids.length) return [];
  const users = await userModel.listWhole({
    authUser: SYSTEM_USER,
    tx,
    filter: { id: { type: "inArray", value: ids } },
    paginate: { page: 1, limit: 100 },
  });
  if (isError(users)) return users;
  return users.data.map((u) => ({ userId: u.id, email: u.email }));
};

/** A member's name as the owners' email gives it: their name, else their address. */
const memberNameOf = async (userId: string, tx: Tx) => {
  const user = await userModel.getWholeById(userId, { authUser: SYSTEM_USER, tx });
  if (isError(user)) return user;
  return user?.name?.trim() || user?.email || "A member";
};

/**
 * Queue `change`'s email to the group's owners (and `formerOwnerId`, an
 * owner the change demoted or removed) in `tx`. The outbox ids, or [].
 */
const tellOwners = async (
  mail: StaffGroupMailer | undefined,
  args: { groupId: string; auditId: string; change: StaffGroupChange; formerOwnerId?: string },
  tx: Tx,
) => {
  if (!mail) return [];
  const to = await ownersOf(args.groupId, tx, args.formerOwnerId ? [args.formerOwnerId] : []);
  if (isError(to)) return to;
  if (!to.length) return [];
  const groupName = await groupDisplayName(args.groupId, tx);
  if (isError(groupName)) return groupName;
  return mail({ groupId: args.groupId, groupName, change: args.change, auditId: args.auditId, to }, tx);
};

/** Give a member a new role, as the system, and record it as `action`. */
const setRole = (
  ctx: ServiceContext,
  input: { groupId: string; userId: string; role: GroupRoleName; reason: string },
  action: "group.promoteOwner" | "group.changeRole",
  opts: { mail?: StaffGroupMailer },
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

    const memberName = await memberNameOf(input.userId, tx);
    if (isError(memberName)) return memberName;
    const change: StaffGroupChange =
      action === "group.promoteOwner"
        ? { kind: "madeOwner", memberName, from: membership.role }
        : { kind: "roleChanged", memberName, from: membership.role, to: updated.role };
    const queued = await tellOwners(
      opts.mail,
      {
        groupId: input.groupId,
        auditId: recorded.id,
        change,
        ...(membership.role === "owner" ? { formerOwnerId: input.userId } : {}),
      },
      tx,
    );
    if (isError(queued)) return queued;
    return { groupId: input.groupId, userId: input.userId, role: updated.role, queued };
  }, ctx);

/** Admins (`groups.manage`): make a member an owner (owner recovery). `invited_by` stays as it was. */
export const promoteOwner = (
  ctx: ServiceContext,
  input: { groupId: string; userId: string; reason: string },
  opts: { mail?: StaffGroupMailer } = {},
) => setRole(ctx, { ...input, role: "owner" }, "group.promoteOwner", opts);

/**
 * Admins (`groups.manage`): change a member's role to admin, caretaker or
 * viewer. Demoting the last owner is refused (`careGroupMemberService:lastOwner`).
 */
export const changeRole = (
  ctx: ServiceContext,
  input: { groupId: string; userId: string; role: StaffSettableGroupRole; reason: string },
  opts: { mail?: StaffGroupMailer } = {},
) => {
  if (!STAFF_SETTABLE_GROUP_ROLES.some((role) => role === input.role))
    return Promise.resolve(newError({ code: "groupAdminService:invalid", meta: { field: "role" } }));
  return setRole(ctx, input, "group.changeRole", opts);
};

/** Admins (`groups.manage`): remove a member. Removing the last owner is refused. */
export const removeMember = (
  ctx: ServiceContext,
  input: { groupId: string; userId: string; reason: string },
  opts: { mail?: StaffGroupMailer } = {},
) =>
  withTransaction(async (tx) => {
    const refused = staffRefusal(ctx, "groups.manage");
    if (refused) return refused;
    const reason = reasonOf(input.reason);
    if (isError(reason)) return reason;
    const membership = await membershipOf(input.groupId, input.userId, tx);
    if (isError(membership)) return membership;
    // Named before they go, while their account is still a member's.
    const memberName = await memberNameOf(input.userId, tx);
    if (isError(memberName)) return memberName;

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

    const queued = await tellOwners(
      opts.mail,
      {
        groupId: input.groupId,
        auditId: recorded.id,
        change: { kind: "removed", memberName, from: membership.role },
        ...(membership.role === "owner" ? { formerOwnerId: input.userId } : {}),
      },
      tx,
    );
    if (isError(queued)) return queued;
    return { groupId: input.groupId, userId: input.userId, queued };
  }, ctx);

/**
 * Admins (`groups.manage`): send an owner invite to `email` (the
 * `ownerInvite` email through `opts.mail`), as the system with the staff
 * member as the one who attested, as a staff-made group's invite is. Only
 * into a group with no owner (`groupAdminService:hasOwner`, checked on the
 * locked owner rows): staff recover an ownerless group, never add an owner
 * beside the family's. The invite rules apply: not a current member, not a
 * second waiting invite. The group's owners hear of it through
 * `opts.ownersMail` (none, as it stands). Returns the outbox rows to deliver
 * after commit.
 */
export const inviteOwner = (
  ctx: ServiceContext,
  input: { groupId: string; email: string; reason: string },
  { ownersMail, ...opts }: { mail?: InviteMailer; ownersMail?: StaffGroupMailer } = {},
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
    const owners = await careGroupMemberModel.lockOwners(input.groupId, tx);
    if (isError(owners)) return owners;
    if (owners > 0) return newError({ code: "groupAdminService:hasOwner" });

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

    const told = await tellOwners(
      ownersMail,
      {
        groupId: input.groupId,
        auditId: recorded.id,
        change: { kind: "ownerInvited", email: sent.invite.email ?? email.data },
      },
      tx,
    );
    if (isError(told)) return told;
    return { inviteId: sent.invite.id, email: sent.invite.email, queued: sent.queued, told };
  }, ctx);
