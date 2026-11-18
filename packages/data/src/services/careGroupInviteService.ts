import type { GroupRoleName } from "../constants";
import type { ServiceContext, ServiceSelectArgs } from "./types";

import { randomBytes } from "node:crypto";
import { DEFAULT_PAGE_SIZE } from "../constants";
import { withTransaction } from "../db";
import { isError, newError } from "../errors";
import { careGroupInviteModel, careGroupMemberModel } from "../models";
import { isSystemUser } from "../permissions";

export const serviceName = "careGroupInvite";
export const schemaName = careGroupInviteModel.schemaName;

type K = typeof schemaName;

export const INVITE_TTL_DAYS = 7;

// Reads and deletes go straight to the model (RBAC: group owners and admins).
// Sending the email and accepting an invite come later, with auth.
export const get = (ctx: ServiceContext, opts: ServiceSelectArgs<K> = {}) =>
  careGroupInviteModel.get({ ...ctx, ...opts });

export const getById = (ctx: ServiceContext, id: string) => careGroupInviteModel.getById(id, ctx);

export const list = (ctx: ServiceContext, opts: ServiceSelectArgs<K> = {}) =>
  careGroupInviteModel.list({
    ...ctx,
    ...opts,
    paginate: opts.paginate ?? { page: 1, limit: DEFAULT_PAGE_SIZE },
  });

export const remove = (ctx: ServiceContext, opts: ServiceSelectArgs<K>) =>
  careGroupInviteModel.remove({ ...ctx, ...opts });

export type InviteCreateData = {
  groupId: string;
  email: string;
  role: GroupRoleName;
};

/**
 * Invite someone to a group. Returns the invite and its raw token, which
 * goes in the invite link; it isn't stored and can't be read back.
 */
export const create = (ctx: ServiceContext, data: InviteCreateData) =>
  withTransaction(async (tx) => {
    if (data.role === "owner" && !isSystemUser(ctx.authUser)) {
      const role = ctx.authUser
        ? await careGroupMemberModel.getRole(data.groupId, ctx.authUser.id, { tx })
        : null;
      if (isError(role)) return role;
      if (role !== "owner") return newError({ code: "careGroupInviteService:ownerOnly" });
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const invite = await careGroupInviteModel.create({
      ...ctx,
      tx,
      data: { ...data, tokenHash: careGroupInviteModel.hashInviteToken(token), expiresAt },
    });
    if (isError(invite)) return invite;
    return { invite, token };
  }, ctx);

/** Withdraw a pending invite. */
export const revoke = async (ctx: ServiceContext, id: string) => {
  const updated = await careGroupInviteModel.update({
    ...ctx,
    filter: { id: { type: "eq", value: id }, status: { type: "eq", value: "pending" } },
    data: { status: "revoked" },
  });
  if (isError(updated)) {
    return updated.code === "baseModel:update:nothingUpdated"
      ? newError({ code: "careGroupInviteService:notFound" })
      : updated;
  }
  return updated[0] ?? newError({ code: "careGroupInviteService:notFound" });
};
