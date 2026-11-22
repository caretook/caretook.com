import type { CareGroupInsert, CareRecipientInsert } from "../db";
import type { ServiceContext, ServiceSelectArgs, ServiceUpdateArgs } from "./types";

import { DEFAULT_PAGE_SIZE } from "../constants";
import { withTransaction } from "../db";
import { isTimeZone } from "../db/schema";
import { isError, newError } from "../errors";
import { careGroupMemberModel, careGroupModel, careRecipientModel } from "../models";
import { isSystemUser } from "../permissions";
import { revokeForGroup } from "./connectorGrantService";
import { addDefaults as addDefaultPasses } from "./medicationPassService";

export const serviceName = "careGroup";
export const schemaName = careGroupModel.schemaName;

type K = typeof schemaName;

export type CareGroupCreateData = CareGroupInsert & {
  /** The care recipient's profile, created in the same transaction. */
  recipient?: Omit<CareRecipientInsert, "groupId">;
};

/**
 * Start a care group. The actor becomes its first owner; the recipient
 * profile, when given, is created with it. All or nothing.
 */
export const create = (ctx: ServiceContext, { recipient, ...data }: CareGroupCreateData) =>
  withTransaction(async (tx) => {
    const group = await careGroupModel.create({ ...ctx, tx, data });
    if (isError(group)) return group;
    if (!group) return { group: null, recipient: null };

    if (!recipient) return { group, recipient: null };
    // Where the recipient lives: the zone of the device that creates the group, unless it says otherwise.
    if (!isTimeZone(recipient.timeZone)) return newError({ code: "careRecipientService:invalidTimeZone" });

    const created = await careRecipientModel.create({
      ...ctx,
      tx,
      data: { ...recipient, groupId: group.id },
    });
    if (isError(created)) return created;
    if (created) {
      const passes = await addDefaultPasses(tx, { groupId: group.id, recipientId: created.id });
      if (passes) return passes;
    }
    return { group, recipient: created };
  }, ctx);

export const get = (ctx: ServiceContext, opts: ServiceSelectArgs<K> = {}) =>
  careGroupModel.get({ ...ctx, ...opts });

export const getById = (ctx: ServiceContext, id: string) => careGroupModel.getById(id, ctx);

export const list = (ctx: ServiceContext, opts: ServiceSelectArgs<K> = {}) =>
  careGroupModel.list({ ...ctx, ...opts, paginate: opts.paginate ?? { page: 1, limit: DEFAULT_PAGE_SIZE } });

/**
 * Update groups in the actor's scope (owners and admins, in SQL). The
 * Assistants switch (`connectorsEnabled`, connectors PRD) is owners' only,
 * one group at a time; turning it off revokes every member's connection in
 * the same transaction, and turning it on restores none.
 */
export const update = (ctx: ServiceContext, opts: ServiceUpdateArgs<K>) => {
  if (opts.data.connectorsEnabled === undefined) return careGroupModel.update({ ...ctx, ...opts });
  const target = opts.filter?.id;
  const groupId = target && "value" in target && target.type === "eq" ? target.value : undefined;
  if (typeof groupId !== "string")
    return Promise.resolve(newError({ code: "careGroupService:connectorsOwnerOnly" }));

  return withTransaction(async (tx) => {
    if (!isSystemUser(ctx.authUser)) {
      const role = ctx.authUser ? await careGroupMemberModel.getRole(groupId, ctx.authUser.id, { tx }) : null;
      if (isError(role)) return role;
      if (role !== "owner") return newError({ code: "careGroupService:connectorsOwnerOnly" });
    }
    const updated = await careGroupModel.update({ ...ctx, ...opts, tx });
    if (isError(updated)) return updated;
    if (opts.data.connectorsEnabled === false) {
      const revoked = await revokeForGroup(tx, groupId);
      if (isError(revoked)) return revoked;
    }
    return updated;
  }, ctx);
};

/** Deleting a group deletes its members, recipient and invites (FK cascade). */
export const remove = (ctx: ServiceContext, opts: ServiceSelectArgs<K>) =>
  careGroupModel.remove({ ...ctx, ...opts });

export const upsert = (ctx: ServiceContext, data: CareGroupInsert) => careGroupModel.upsert({ ...ctx, data });
