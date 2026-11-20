import type { Tx } from "../db";

import { SYSTEM_USER } from "../constants";
import { isError } from "../errors";
import { careGroupModel, careRecipientModel } from "../models";

const system = (tx?: Tx) => ({ authUser: SYSTEM_USER, tx });

/** A group's name as its members see it (the group menu's rule). Unscoped: callers check access first. */
export const groupDisplayName = async (groupId: string, tx?: Tx) => {
  const recipient = await careRecipientModel.get({
    ...system(tx),
    filter: { groupId: { type: "eq", value: groupId } },
  });
  if (isError(recipient)) return recipient;
  if (recipient) return recipient.displayName;
  const group = await careGroupModel.getById(groupId, system(tx));
  if (isError(group)) return group;
  return group?.name ?? "a care group";
};
