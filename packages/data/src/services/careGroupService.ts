import type { CareGroupInsert, CareRecipientInsert } from "../db";
import type { ServiceContext, ServiceSelectArgs, ServiceUpdateArgs } from "./types";

import { DEFAULT_PAGE_SIZE } from "../constants";
import { withTransaction } from "../db";
import { isTimeZone } from "../db/schema";
import { isError, newError } from "../errors";
import { careGroupModel, careRecipientModel } from "../models";

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
    return { group, recipient: created };
  }, ctx);

export const get = (ctx: ServiceContext, opts: ServiceSelectArgs<K> = {}) =>
  careGroupModel.get({ ...ctx, ...opts });

export const getById = (ctx: ServiceContext, id: string) => careGroupModel.getById(id, ctx);

export const list = (ctx: ServiceContext, opts: ServiceSelectArgs<K> = {}) =>
  careGroupModel.list({ ...ctx, ...opts, paginate: opts.paginate ?? { page: 1, limit: DEFAULT_PAGE_SIZE } });

export const update = (ctx: ServiceContext, opts: ServiceUpdateArgs<K>) =>
  careGroupModel.update({ ...ctx, ...opts });

/** Deleting a group deletes its members, recipient and invites (FK cascade). */
export const remove = (ctx: ServiceContext, opts: ServiceSelectArgs<K>) =>
  careGroupModel.remove({ ...ctx, ...opts });

export const upsert = (ctx: ServiceContext, data: CareGroupInsert) => careGroupModel.upsert({ ...ctx, data });
