import type { Tx } from "../db";
import type { LinkRole } from "../db/schema";
import type { AppError } from "../errors";
import type { CareGroupInviteModel, CareGroupJoinRequestModel } from "../models";
import type { ServiceContext, ServiceSelectArgs } from "./types";

import { DEFAULT_PAGE_SIZE, GROUP_MANAGER_ROLES, SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import { CONSENT_VERSION, linkRoleAllowed } from "../db/schema";
import { isError, newError } from "../errors";
import {
  careGroupConsentModel,
  careGroupInviteModel,
  careGroupJoinRequestModel,
  careGroupMemberModel,
  userModel,
} from "../models";
import { isSystemUser } from "../permissions";
import * as careGroupMemberService from "./careGroupMemberService";
import { groupDisplayName } from "./groupNames";

// Requests to join a care group from an invite link (invites slice 4).
// Using a link (careGroupInviteService.accept) makes a pending request;
// an owner or admin approves it (the requester becomes a member with the
// link's role) or declines it, and the requester may withdraw it. Every
// write is the system's, inside these functions, after checking the actor.
// Each step emails through an injected `JoinMailer`, in the same transaction.

export const schemaName = careGroupJoinRequestModel.schemaName;

type K = typeof schemaName;

const system = (tx?: Tx) => ({ authUser: SYSTEM_USER, tx });
const byId = (id: string) => ({ id: { type: "eq" as const, value: id } });

// Scoped reads: a group's owners and admins see its requests, a requester their own.
export const get = (ctx: ServiceContext, opts: ServiceSelectArgs<K> = {}) =>
  careGroupJoinRequestModel.get({ ...ctx, ...opts });

export const getById = (ctx: ServiceContext, id: string) => careGroupJoinRequestModel.getById(id, ctx);

export const list = (ctx: ServiceContext, opts: ServiceSelectArgs<K> = {}) =>
  careGroupJoinRequestModel.list({
    ...ctx,
    ...opts,
    paginate: opts.paginate ?? { page: 1, limit: DEFAULT_PAGE_SIZE },
  });

// ---------------------------------------------------------------------------
// Emails
// ---------------------------------------------------------------------------

/** Someone an email goes to. */
export type JoinRecipient = { userId: string; email: string };

/**
 * What a join step tells people. No health details: the group's display
 * name, the requester's name and address (to its owners and admins only),
 * and the role.
 */
export type JoinNotice =
  | {
      kind: "joinRequested";
      request: CareGroupJoinRequestModel;
      groupName: string;
      requester: { name: string | null; email: string };
      /** The group's owners and admins. */
      to: JoinRecipient[];
    }
  | { kind: "joinApproved"; request: CareGroupJoinRequestModel; groupName: string; to: JoinRecipient[] }
  | { kind: "joinDeclined"; request: CareGroupJoinRequestModel; groupName: string; to: JoinRecipient[] };

/**
 * Queues a join step's emails in the service's transaction (the API passes
 * one that calls @caretook/notifications' notify with `tx`). Returns the
 * outbox ids, to deliver after commit.
 */
export type JoinMailer = (notice: JoinNotice, tx: Tx) => Promise<string[] | AppError>;

/** The group's owners and admins, with their addresses. Unscoped: only for emailing them. */
const managersOf = async (groupId: string, tx: Tx) => {
  const members = await careGroupMemberModel.list({
    ...system(tx),
    filter: {
      groupId: { type: "eq", value: groupId },
      role: { type: "inArray", value: [...GROUP_MANAGER_ROLES] },
    },
    paginate: { page: 1, limit: 100 },
  });
  if (isError(members)) return members;
  const ids = members.data.map((m) => m.userId);
  if (!ids.length) return [];
  const users = await userModel.listWhole({
    ...system(tx),
    filter: { id: { type: "inArray", value: ids } },
    paginate: { page: 1, limit: 100 },
  });
  if (isError(users)) return users;
  return users.data.map((u) => ({ userId: u.id, email: u.email }));
};

const userOf = async (userId: string, tx: Tx) => {
  const user = await userModel.getWholeById(userId, system(tx));
  if (isError(user)) return user;
  return user ?? newError({ code: "joinRequestService:notFound" });
};

const nameOfGroup = (groupId: string, tx: Tx) => groupDisplayName(groupId, tx);

const send = async (mail: JoinMailer | undefined, notice: JoinNotice, tx: Tx) => {
  if (!mail || !notice.to.length) return [];
  return mail(notice, tx);
};

// ---------------------------------------------------------------------------
// Asking (from careGroupInviteService.accept, for a link)
// ---------------------------------------------------------------------------

/**
 * Ask to join with link `invite` as `userId`, who agreed to CONSENT_TEXT.
 * Returns their pending request: the one already waiting (asking again
 * changes nothing), or a new one, which counts a use of the link, records
 * consent and emails the group's owners and admins. With `existingOnly`, only
 * the waiting one (or null). Runs as the system in
 * the caller's transaction, with the invite's row locked and its state checked.
 */
export const requestWithLink = async (
  { invite, userId }: { invite: CareGroupInviteModel; userId: string },
  tx: Tx,
  mail?: JoinMailer,
  opts: { existingOnly?: boolean } = {},
) => {
  const waiting = await careGroupJoinRequestModel.get({
    ...system(tx),
    filter: {
      groupId: { type: "eq", value: invite.groupId },
      userId: { type: "eq", value: userId },
      status: { type: "eq", value: "pending" },
    },
  });
  if (isError(waiting)) return waiting;
  if (waiting) return { request: waiting, created: false, queued: [] as string[] };
  if (opts.existingOnly) return null;

  if (!linkRoleAllowed(invite.role)) return newError({ code: "careGroupInviteService:linkRole" });
  const role = invite.role as LinkRole;

  const request = await careGroupJoinRequestModel.create({
    ...system(tx),
    data: { groupId: invite.groupId, userId, inviteId: invite.id, role, status: "pending" },
  });
  if (isError(request)) return request;
  if (!request) return newError({ code: "joinRequestService:notFound" });

  const used = await careGroupInviteModel.update({
    ...system(tx),
    filter: byId(invite.id),
    data: { useCount: invite.useCount + 1 },
  });
  if (isError(used)) return used;

  const consented = await careGroupConsentModel.create({
    ...system(tx),
    data: {
      groupId: invite.groupId,
      userId,
      kind: "joiner",
      consentVersion: CONSENT_VERSION,
      inviteId: invite.id,
    },
  });
  if (isError(consented)) return consented;

  const [requester, groupName, to] = [
    await userOf(userId, tx),
    await nameOfGroup(invite.groupId, tx),
    await managersOf(invite.groupId, tx),
  ];
  if (isError(requester)) return requester;
  if (isError(groupName)) return groupName;
  if (isError(to)) return to;
  const queued = await send(
    mail,
    {
      kind: "joinRequested",
      request,
      groupName,
      requester: { name: requester.name?.trim() || null, email: requester.email },
      to,
    },
    tx,
  );
  if (isError(queued)) return queued;
  return { request, created: true, queued };
};

// ---------------------------------------------------------------------------
// Answering
// ---------------------------------------------------------------------------

/**
 * Lock a pending request and check the actor manages its group. A request
 * in a group the actor isn't in is "not found" (nothing leaks); a member
 * who doesn't manage it is refused.
 */
const lockForManager = async (ctx: ServiceContext, id: string, tx: Tx) => {
  const request = await careGroupJoinRequestModel.lock(id, tx);
  if (isError(request)) return request;
  if (!request) return newError({ code: "joinRequestService:notFound" });
  if (!isSystemUser(ctx.authUser)) {
    if (!ctx.authUser) return newError({ code: "permissions:unauthenticated" });
    const role = await careGroupMemberModel.getRole(request.groupId, ctx.authUser.id, { tx });
    if (isError(role)) return role;
    if (!role) return newError({ code: "joinRequestService:notFound" });
    if (!GROUP_MANAGER_ROLES.some((manager) => manager === role))
      return newError({ code: "joinRequestService:notAllowed" });
  }
  if (request.status !== "pending") return newError({ code: "joinRequestService:notFound" });
  return request;
};

const deciderOf = (ctx: ServiceContext) => (isSystemUser(ctx.authUser) ? null : (ctx.authUser?.id ?? null));

/** Who let them in, for the Members page: the link's maker, else whoever approved. */
const inviterOf = async (request: CareGroupJoinRequestModel, decider: string | null, tx: Tx) => {
  if (!request.inviteId) return decider;
  const invite = await careGroupInviteModel.getById(request.inviteId, system(tx));
  if (isError(invite)) return invite;
  const maker = invite?.consentAttestedBy ?? invite?.createdBy ?? null;
  return maker && maker !== SYSTEM_USER.id ? maker : decider;
};

const decide = async (
  request: CareGroupJoinRequestModel,
  status: "approved" | "declined",
  decider: string | null,
  tx: Tx,
) => {
  const updated = await careGroupJoinRequestModel.update({
    ...system(tx),
    filter: byId(request.id),
    data: { status, decidedBy: decider, decidedAt: new Date().toISOString() },
  });
  if (isError(updated)) return updated;
  return updated[0] ?? newError({ code: "joinRequestService:notFound" });
};

const requesterNotice = async (
  kind: "joinApproved" | "joinDeclined",
  request: CareGroupJoinRequestModel,
  tx: Tx,
  mail: JoinMailer | undefined,
) => {
  const [requester, groupName] = [await userOf(request.userId, tx), await nameOfGroup(request.groupId, tx)];
  if (isError(requester)) return requester;
  if (isError(groupName)) return groupName;
  return send(mail, { kind, request, groupName, to: [{ userId: requester.id, email: requester.email }] }, tx);
};

/**
 * Approve a waiting request (the group's owners and admins): the requester
 * becomes a member with the request's role (caretaker or viewer), and is
 * emailed. Someone who joined meanwhile keeps their membership.
 */
export const approve = (ctx: ServiceContext, id: string, opts: { mail?: JoinMailer } = {}) =>
  withTransaction(async (tx) => {
    const request = await lockForManager(ctx, id, tx);
    if (isError(request)) return request;
    if (!linkRoleAllowed(request.role)) return newError({ code: "careGroupInviteService:linkRole" });

    const current = await careGroupMemberModel.getRole(request.groupId, request.userId, { tx });
    if (isError(current)) return current;
    const decider = deciderOf(ctx);
    if (!current) {
      const invitedBy = await inviterOf(request, decider, tx);
      if (isError(invitedBy)) return invitedBy;
      const member = await careGroupMemberService.create(system(tx), {
        groupId: request.groupId,
        userId: request.userId,
        role: request.role,
        invitedBy,
      });
      if (isError(member)) return member;
    }

    const approved = await decide(request, "approved", decider, tx);
    if (isError(approved)) return approved;
    const queued = await requesterNotice("joinApproved", approved, tx, opts.mail);
    if (isError(queued)) return queued;
    return { request: approved, queued };
  }, ctx);

/** Decline a waiting request (the group's owners and admins). The requester is emailed. */
export const decline = (ctx: ServiceContext, id: string, opts: { mail?: JoinMailer } = {}) =>
  withTransaction(async (tx) => {
    const request = await lockForManager(ctx, id, tx);
    if (isError(request)) return request;
    const declined = await decide(request, "declined", deciderOf(ctx), tx);
    if (isError(declined)) return declined;
    const queued = await requesterNotice("joinDeclined", declined, tx, opts.mail);
    if (isError(queued)) return queued;
    return { request: declined, queued };
  }, ctx);

/** Take back your own waiting request. */
export const withdraw = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const request = await careGroupJoinRequestModel.lock(id, tx);
    if (isError(request)) return request;
    const mine = !!request && !!ctx.authUser && request.userId === ctx.authUser.id;
    if (!request || !mine || request.status !== "pending")
      return newError({ code: "joinRequestService:notFound" });
    const updated = await careGroupJoinRequestModel.update({
      ...system(tx),
      filter: byId(request.id),
      data: { status: "withdrawn", decidedAt: new Date().toISOString() },
    });
    if (isError(updated)) return updated;
    return updated[0] ?? newError({ code: "joinRequestService:notFound" });
  }, ctx);
