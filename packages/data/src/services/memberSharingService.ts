import type { z } from "zod";
import type { CareGroupMember, ContactValues, Tx } from "../db";
import type { ServiceContext } from "./types";

import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import { memberSharingZSchema } from "../db/schema";
import { isError, newError } from "../errors";
import { careGroupMemberModel, memberContactShareModel, userContactModel } from "../models";
import { dropMember } from "./emergencyContactService";
import { canBeEmergencyContact, sharedContact, sharesAnything } from "../domain/profiles/profileVisibility";

// What a member shares with each of their care groups (profiles): their
// choices on the membership (`shared_fields`, `relationship`), and the
// `member_contact_share` projection the group reads. The projection is only
// ever written here, in the same transaction as the change that moves it.

export const schemaName = memberContactShareModel.schemaName;

const system = (tx: Tx) => ({ authUser: SYSTEM_USER, tx });

const invalid = (error: z.ZodError) =>
  newError({
    code: "memberSharingService:invalid",
    meta: { issues: error.issues.map(({ path, message }) => ({ path: path.join("."), message })) },
  });

/** A user's own contact details (empty when none are saved). Unscoped: for the projection only. */
const contactOf = async (userId: string, tx: Tx) => {
  const row = await userContactModel.get({
    ...system(tx),
    filter: { userId: { type: "eq", value: userId } },
  });
  if (isError(row)) return row;
  const contact: ContactValues = {
    phones: row?.phones ?? [],
    contactEmail: row?.contactEmail ?? null,
    address: row?.address ?? null,
  };
  return contact;
};

/**
 * Bring one membership's share row in step with the member's contact
 * details and choices: written when it shows anything, deleted when not.
 * A member left with no shared phone drops off the emergency list (and
 * loses the primary flag). Returns whether that happened.
 */
const syncShare = async (tx: Tx, membership: CareGroupMember, contact: ContactValues) => {
  const share = sharedContact(contact, membership.sharedFields);
  const existing = await memberContactShareModel.getById(membership.id, system(tx));
  if (isError(existing)) return existing;

  if (sharesAnything(share)) {
    const res = await memberContactShareModel.upsert({
      ...system(tx),
      data: { id: membership.id, groupId: membership.groupId, userId: membership.userId, ...share },
    });
    if (isError(res)) return res;
  } else if (existing) {
    const res = await memberContactShareModel.remove({
      ...system(tx),
      filter: { id: { type: "eq", value: membership.id } },
    });
    if (isError(res)) return res;
  }

  if (canBeEmergencyContact(share)) return false;
  return dropMember(tx, membership.groupId, membership.userId);
};

/**
 * Rebuild every share of `userId` (after their contact details change), or
 * only `groupId`'s. Returns the groups whose emergency list they left, so
 * managers can be told.
 */
export const rebuildShares = async (tx: Tx, userId: string, groupId?: string) => {
  const contact = await contactOf(userId, tx);
  if (isError(contact)) return contact;
  const memberships = await careGroupMemberModel.listForUser(userId, tx);
  if (isError(memberships)) return memberships;

  const droppedFrom: string[] = [];
  for (const membership of memberships) {
    if (groupId && membership.groupId !== groupId) continue;
    const dropped = await syncShare(tx, membership, contact);
    if (isError(dropped)) return dropped;
    if (dropped) droppedFrom.push(membership.groupId);
  }
  return droppedFrom;
};

/**
 * Change what the actor shares with `groupId` and how they're related to the
 * recipient. Fields left out keep their value. Only for themselves: there's
 * no way to set another member's choices. A non-member gets not-found.
 */
export const update = (ctx: ServiceContext, groupId: string, input: z.input<typeof memberSharingZSchema>) =>
  withTransaction(async (tx) => {
    const parsed = memberSharingZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    if (!ctx.authUser) return newError({ code: "permissions:unauthenticated" });

    const membership = await careGroupMemberModel.get({
      ...ctx,
      tx,
      filter: { groupId: { type: "eq", value: groupId }, userId: { type: "eq", value: ctx.authUser.id } },
    });
    if (isError(membership)) return membership;
    if (!membership) return newError({ code: "memberSharingService:notFound" });

    const data = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
    let saved = membership;
    if (Object.keys(data).length) {
      // The member's own choices, which the permissions map keeps for the
      // system: written as the system, now it's checked they're the actor's.
      const updated = await careGroupMemberModel.update({
        ...system(tx),
        filter: { id: { type: "eq", value: membership.id } },
        data,
      });
      if (isError(updated)) return updated;
      saved = updated[0] ?? membership;
    }

    const droppedFrom = await rebuildShares(tx, ctx.authUser.id, groupId);
    if (isError(droppedFrom)) return droppedFrom;

    const share = await memberContactShareModel.getById(membership.id, { ...ctx, tx });
    if (isError(share)) return share;
    return {
      groupId,
      userId: saved.userId,
      relationship: saved.relationship,
      sharedFields: saved.sharedFields,
      share: share ? { phones: share.phones, email: share.email, address: share.address } : null,
      droppedFromEmergencyList: droppedFrom.length > 0,
    };
  }, ctx);
