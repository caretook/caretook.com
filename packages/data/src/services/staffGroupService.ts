import type { InviteMailer } from "./careGroupInviteService";
import type { ServiceContext } from "./types";

import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import { FALLBACK_TIME_ZONE } from "../db/schema";
import { isError, newError } from "../errors";
import { careGroupInviteModel, careGroupModel, careRecipientModel } from "../models";
import * as careGroupInviteService from "./careGroupInviteService";
import { addDefaults as addDefaultPasses } from "./medicationPassService";

export const serviceName = "staffGroup";
export const schemaName = careGroupModel.schemaName;

// Staff onboarding a family by hand (invites slice 5, /admin's New group):
// a group with its recipient and no members, plus an owner invite by email.
// The staff member never becomes a member, so they see none of its care
// data; the group records them as its creator and the invite as the one who
// confirmed the recipient agreed to share.

export type StaffGroupInput = {
  groupName: string;
  recipientName: string;
  ownerEmail: string;
  /** The recipient's zone (the staff member's browser's); none is `FALLBACK_TIME_ZONE`. */
  timeZone?: string | null;
  /** The staff member confirms the recipient (or their representative) agreed to share. */
  attested: boolean;
};

const isStaff = (ctx: ServiceContext) => !!ctx.authUser?.roleNames.includes("admin");

export const createWithOwnerInvite = (
  ctx: ServiceContext,
  input: StaffGroupInput,
  opts: { mail?: InviteMailer } = {},
) =>
  withTransaction(async (tx) => {
    if (!isStaff(ctx) || !ctx.authUser) return newError({ code: "staffGroupService:staffOnly" });
    if (!input.attested) return newError({ code: "careGroupInviteService:notAttested" });
    const staffId = ctx.authUser.id;
    const system = { authUser: SYSTEM_USER, tx };

    const group = await careGroupModel.createWithoutOwner({
      authUser: ctx.authUser,
      tx,
      data: { name: input.groupName.trim() },
    });
    if (isError(group)) return group;
    if (!group) return newError({ code: "baseModel:create:nothingCreated" });

    const recipient = await careRecipientModel.create({
      ...system,
      data: {
        groupId: group.id,
        name: input.recipientName.trim(),
        timeZone: input.timeZone || FALLBACK_TIME_ZONE,
      },
    });
    if (isError(recipient)) return recipient;
    if (!recipient) return newError({ code: "baseModel:create:nothingCreated" });
    const passes = await addDefaultPasses(tx, { groupId: group.id, recipientId: recipient.id });
    if (passes) return passes;

    const sent = await careGroupInviteService.createEmail(
      system,
      { groupId: group.id, email: input.ownerEmail, role: "owner", attested: true },
      opts,
    );
    if (isError(sent)) return sent;

    const attested = await careGroupInviteModel.update({
      ...system,
      filter: { id: { type: "eq", value: sent.invite.id } },
      data: { consentAttestedBy: staffId },
    });
    if (isError(attested)) return attested;

    return { groupId: group.id, groupName: group.name, inviteId: sent.invite.id, queued: sent.queued };
  }, ctx);
