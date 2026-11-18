import type { CareGroup } from "../../db";
import type { QueryCreateArgs } from "../base/queryHelpers";

import { randomUUID } from "node:crypto";
import { SYSTEM_USER } from "../../constants";
import { withTransaction } from "../../db";
import { isError } from "../../errors";
import { isSystemUser, rejectError } from "../../permissions";
import * as baseModel from "../base";
import * as careGroupMemberModel from "../careGroupMember";

export const schemaName = "careGroupSchema";

export const dbToModel = (row: CareGroup) => row;

const base = baseModel.getFunctions({ schemaName, dbToModel });

export const { get, getById, list, remove, update } = base;

export type CareGroupCreateArgs = QueryCreateArgs<typeof schemaName> & {
  /** The first owner. Defaults to the actor; only the system may name someone else. */
  ownerId?: string;
};

/**
 * Create a group and make its first owner a member, in one transaction.
 * Without the membership nobody could read the group, so there's no
 * plain create.
 */
export const create = (args: CareGroupCreateArgs) =>
  withTransaction(async (tx) => {
    const { authUser } = args;
    const isSystem = isSystemUser(authUser);
    const ownerId = args.ownerId ?? (isSystem ? undefined : authUser?.id);

    if (!authUser || !ownerId) return rejectError(authUser);
    if (ownerId !== authUser.id && !isSystem) return rejectError(authUser);

    const id = args.data.id ?? randomUUID();

    // Checks create permission and inserts. Its re-read comes back null
    // (the actor isn't a member yet), so read again once they are.
    const created = await base.create({ authUser, tx, data: { ...args.data, id } });
    if (isError(created)) return created;

    const owner = await careGroupMemberModel.insertFirstOwner({
      groupId: id,
      userId: ownerId,
      actorId: authUser.id,
      tx,
    });
    if (isError(owner)) return owner;

    return getById(id, { authUser, tx });
  }, args);

/** Create (with first owner) or update. The shape of a PowerSync PUT. */
export const upsert = async (args: CareGroupCreateArgs) => {
  const id = args.data.id;
  if (!id) return create(args);

  const existing = await getById(id, { authUser: SYSTEM_USER, tx: args.tx });
  if (isError(existing)) return existing;
  if (!existing) return create(args);

  const updated = await update({ ...args, filter: { id: { type: "eq", value: id } } });
  if (isError(updated)) return updated;
  return updated[0] ?? null;
};
