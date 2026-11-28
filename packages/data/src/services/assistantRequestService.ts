import type { Tx } from "../db";
import type { AppError } from "../errors";
import type { AssistantRequestModel } from "../models";
import type { ServiceContext } from "./types";

import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import { ASSISTANT_REQUEST_WINDOW_DAYS } from "../db/schema";
import { isError, newError } from "../errors";
import { assistantRequestModel, careGroupMemberModel, careGroupModel, userModel } from "../models";
import { isSystemUser } from "../permissions";
import { groupDisplayName } from "./groupNames";

// A member asking their care group's owners to turn assistants on
// (connectors-2, B-194). Any member but an owner may ask while the switch is
// off; each ask emails every owner, at most once a week per member and
// group: within ASSISTANT_REQUEST_WINDOW_DAYS of the last ask, asking again
// returns that one and sends nothing. Every write is the system's, after
// checking the actor. The email goes through an injected
// `AssistantRequestMailer`, in the same transaction.

export const schemaName = assistantRequestModel.schemaName;

const system = (tx?: Tx) => ({ authUser: SYSTEM_USER, tx });
const WINDOW_MS = ASSISTANT_REQUEST_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** A request as the member sees it. */
export type AssistantRequestView = Pick<AssistantRequestModel, "id" | "groupId" | "requestedAt">;

const toView = (row: AssistantRequestModel): AssistantRequestView => ({
  id: row.id,
  groupId: row.groupId,
  requestedAt: row.requestedAt,
});

/** Someone the email goes to. */
export type AssistantRequestRecipient = { userId: string; email: string };

/** What the owners are told. No health details: who asked, and the group's display name. */
export type AssistantRequestNotice = {
  request: AssistantRequestView & { userId: string };
  groupName: string;
  memberName: string;
  /** The group's owners. */
  to: AssistantRequestRecipient[];
};

/**
 * Queues the owners' emails in the service's transaction (the API passes one
 * that calls @caretook/notifications' notify with `tx`). Returns the outbox
 * ids, to deliver after commit.
 */
export type AssistantRequestMailer = (notice: AssistantRequestNotice, tx: Tx) => Promise<string[] | AppError>;

/** The group's owners, with their addresses. Unscoped: only for emailing them. */
const ownersOf = async (groupId: string, tx: Tx) => {
  const owners = await careGroupMemberModel.list({
    ...system(tx),
    filter: { groupId: { type: "eq", value: groupId }, role: { type: "eq", value: "owner" } },
    paginate: { page: 1, limit: 100 },
  });
  if (isError(owners)) return owners;
  const ids = owners.data.map((m) => m.userId);
  if (!ids.length) return [];
  const users = await userModel.listWhole({
    ...system(tx),
    filter: { id: { type: "inArray", value: ids } },
    paginate: { page: 1, limit: 100 },
  });
  if (isError(users)) return users;
  return users.data.filter((u) => !u.disabledAt).map((u) => ({ userId: u.id, email: u.email }));
};

/** The member's last request to the group, read as the system. */
const lastOf = async (groupId: string, userId: string, tx?: Tx) => {
  const rows = await assistantRequestModel.list({
    ...system(tx),
    filter: { groupId: { type: "eq", value: groupId }, userId: { type: "eq", value: userId } },
    orderBy: [{ field: "requestedAt", direction: "desc" }],
    paginate: { page: 1, limit: 1 },
  });
  if (isError(rows)) return rows;
  return rows.data[0] ?? null;
};

const withinWindow = (row: AssistantRequestModel, now: Date) =>
  now.getTime() - new Date(row.requestedAt).getTime() < WINDOW_MS;

/**
 * The actor's last request to `groupId` (or null), whether or not it's
 * still inside the window. A non-member gets `notMember`.
 */
export const latest = async (ctx: ServiceContext, groupId: string) => {
  const actor = ctx.authUser;
  if (!actor || isSystemUser(actor)) return newError({ code: "permissions:unauthenticated" });
  const role = await careGroupMemberModel.getRole(groupId, actor.id, { tx: ctx.tx });
  if (isError(role)) return role;
  if (!role) return newError({ code: "assistantRequestService:notMember" });
  const last = await lastOf(groupId, actor.id, ctx.tx);
  if (isError(last)) return last;
  return last ? toView(last) : null;
};

/**
 * Ask `groupId`'s owners to turn assistants on, as the actor. Refused for a
 * non-member (`notMember`), an owner (`owner`: they can flip the switch) and
 * while the switch is on (`alreadyOn`). Within the window of the actor's
 * last ask, returns that one (`created: false`, nothing sent). Otherwise
 * records the ask and queues an email to every owner through `mail`, in
 * one transaction; deliver `queued` after commit.
 */
export const request = (
  ctx: ServiceContext,
  groupId: string,
  mail?: AssistantRequestMailer,
  opts: { now?: Date } = {},
) =>
  withTransaction(async (tx) => {
    const actor = ctx.authUser;
    if (!actor || isSystemUser(actor)) return newError({ code: "permissions:unauthenticated" });
    const now = opts.now ?? new Date();

    const role = await assistantRequestModel.lockMembership(groupId, actor.id, tx);
    if (isError(role)) return role;
    if (!role) return newError({ code: "assistantRequestService:notMember" });
    if (role === "owner") return newError({ code: "assistantRequestService:owner" });
    const group = await careGroupModel.getById(groupId, system(tx));
    if (isError(group)) return group;
    if (!group) return newError({ code: "assistantRequestService:notMember" });
    if (group.connectorsEnabled) return newError({ code: "assistantRequestService:alreadyOn" });

    const last = await lastOf(groupId, actor.id, tx);
    if (isError(last)) return last;
    if (last && withinWindow(last, now))
      return { request: toView(last), created: false, queued: [] as string[] };

    const created = await assistantRequestModel.create({
      ...system(tx),
      data: { groupId, userId: actor.id, requestedAt: now.toISOString() },
    });
    if (isError(created)) return created;
    if (!created) return newError({ code: "baseModel:create:nothingCreated" });

    let queued: string[] = [];
    if (mail) {
      const to = await ownersOf(groupId, tx);
      if (isError(to)) return to;
      const groupName = await groupDisplayName(groupId, tx);
      if (isError(groupName)) return groupName;
      const member = await userModel.getWholeById(actor.id, system(tx));
      if (isError(member)) return member;
      if (to.length) {
        const ids = await mail(
          {
            request: { ...toView(created), userId: actor.id },
            groupName,
            memberName: member?.name?.trim() || member?.email || "A member",
            to,
          },
          tx,
        );
        if (isError(ids)) return ids;
        queued = ids;
      }
    }
    return { request: toView(created), created: true, queued };
  }, ctx);
