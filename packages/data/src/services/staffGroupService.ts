import type { InviteMailer } from "./careGroupInviteService";
import type { ServiceContext } from "./types";

import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import { auditChanges, FALLBACK_TIME_ZONE } from "../db/schema";
import { isError, newError } from "../errors";
import { careGroupInviteModel, careGroupModel, careRecipientModel } from "../models";
import * as adminAuditService from "./adminAuditService";
import * as careGroupInviteService from "./careGroupInviteService";
import { staffRefusal } from "./staffAccess";
import { addDefaults as addDefaultPasses } from "./medicationPassService";
import { addDefaults as addDefaultSymptoms } from "./symptomTypeService";

export const serviceName = "staffGroup";
export const schemaName = careGroupModel.schemaName;

// Staff onboarding a family by hand (invites slice 5, /admin's New group):
// a group with its recipient and no members, plus an owner invite by email.
// The staff member never becomes a member, so they see none of its care
// data; the group records them as its creator and the invite as the one who
// confirmed the recipient agreed to share. Needs `staffGroups.create`
// (admin and support), and records `staffGroup.create` in the same
// transaction (the group's name and the owner's address, nothing else).

export type StaffGroupInput = {
  groupName: string;
  recipientName: string;
  ownerEmail: string;
  /** The recipient's zone (the staff member's browser's); none is `FALLBACK_TIME_ZONE`. */
  timeZone?: string | null;
  /** The staff member confirms the recipient (or their representative) agreed to share. */
  attested: boolean;
};

export const createWithOwnerInvite = (
  ctx: ServiceContext,
  input: StaffGroupInput,
  opts: { mail?: InviteMailer } = {},
) =>
  withTransaction(async (tx) => {
    if (staffRefusal(ctx, "staffGroups.create") || !ctx.authUser)
      return newError({ code: "staffGroupService:staffOnly" });
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
    const symptoms = await addDefaultSymptoms(tx, group.id);
    if (symptoms) return symptoms;

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
      { ...opts, staffInvite: true },
    );
    if (isError(sent)) return sent;

    const attested = await careGroupInviteModel.update({
      ...system,
      filter: { id: { type: "eq", value: sent.invite.id } },
      data: { consentAttestedBy: staffId },
    });
    if (isError(attested)) return attested;

    const recorded = await adminAuditService.record(tx, {
      actorId: staffId,
      action: "staffGroup.create",
      targetGroupId: group.id,
      changes: auditChanges(null, { name: group.name, ownerEmail: sent.invite.email }, [
        "name",
        "ownerEmail",
      ]),
    });
    if (isError(recorded)) return recorded;

    return { groupId: group.id, groupName: group.name, inviteId: sent.invite.id, queued: sent.queued };
  }, ctx);
