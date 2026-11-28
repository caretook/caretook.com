import type { z } from "zod";
import type { CareGroupMember, CareRecipientDetails, EmergencyRef, Tx } from "../db";
import type { ServiceContext } from "./types";

import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import {
  canBeEmergencyContact,
  canManageEmergencyContacts,
  emergencyOrder,
  emergencyOrderZSchema,
  emergencyRanks,
  emergencyRefKey,
} from "../db/schema";
import { isError, newError } from "../errors";
import { careGroupMemberModel, careRecipientDetailsModel, memberContactShareModel } from "../models";
import { isSystemUser } from "../permissions";

// The group's emergency list (profiles): one order across members and
// outside contacts, and one member marked as the primary contact. Owners and
// admins set both; only members who share a phone with the group can be on
// the list or be the primary contact. Every write renumbers the list 1…n.

export const schemaName = careGroupMemberModel.schemaName;

const system = (tx: Tx) => ({ authUser: SYSTEM_USER, tx });

const invalid = (error: z.ZodError) =>
  newError({
    code: "emergencyContactService:invalid",
    meta: { issues: error.issues.map(({ path, message }) => ({ path: path.join("."), message })) },
  });

const notFound = () => newError({ code: "careGroupService:notFound" });

/** The actor's role in the group (the system acts as an owner); null for a non-member. */
export const actorRole = async (ctx: ServiceContext, groupId: string, tx: Tx) => {
  if (isSystemUser(ctx.authUser)) return "owner" as const;
  if (!ctx.authUser) return null;
  return careGroupMemberModel.getRole(groupId, ctx.authUser.id, { tx });
};

/** Members of the group who share at least one phone with it, by user id. */
const phoneSharers = async (groupId: string, tx: Tx) => {
  const shares = await memberContactShareModel.list({
    ...system(tx),
    filter: { groupId: { type: "eq", value: groupId } },
  });
  if (isError(shares)) return shares;
  return new Set(shares.data.filter((s) => canBeEmergencyContact(s)).map((s) => s.userId));
};

/** The list as stored, plus the primary contact. */
const currentList = (members: readonly CareGroupMember[], details: CareRecipientDetails | null) => ({
  contacts: emergencyOrder(members, details?.outsideContacts ?? []),
  primaryUserId: members.find((m) => m.isPrimaryContact)?.userId ?? null,
});

/**
 * Store `refs` as the list: ranks 1…n, everyone else off it. Writes only the
 * rows that change, as the system (the caller has checked the actor).
 */
const applyOrder = async (
  tx: Tx,
  refs: readonly EmergencyRef[],
  members: readonly CareGroupMember[],
  details: CareRecipientDetails | null,
) => {
  const ranks = emergencyRanks(refs);
  for (const member of members) {
    const rank = ranks.get(emergencyRefKey({ kind: "member", userId: member.userId })) ?? null;
    if (member.emergencyRank === rank) continue;
    const res = await careGroupMemberModel.update({
      ...system(tx),
      filter: { id: { type: "eq", value: member.id } },
      data: { emergencyRank: rank },
    });
    if (isError(res)) return res;
  }

  if (details) {
    const outsideContacts = details.outsideContacts.map((c) => ({
      ...c,
      emergencyRank: ranks.get(emergencyRefKey({ kind: "outside", id: c.id })) ?? null,
    }));
    if (outsideContacts.some((c, i) => c.emergencyRank !== details.outsideContacts[i]?.emergencyRank)) {
      const res = await careRecipientDetailsModel.update({
        ...system(tx),
        filter: { id: { type: "eq", value: details.id } },
        data: { outsideContacts },
      });
      if (isError(res)) return res;
    }
  }
  return null;
};

/**
 * Renumber the group's list 1…n in its current order, after something left
 * it (a member who stopped sharing a phone, a deleted outside contact).
 * Unchecked: callers have checked the actor, and pass their transaction.
 */
export const renumber = async (tx: Tx, groupId: string) => {
  const members = await careGroupMemberModel.lockGroupMembers(groupId, tx);
  if (isError(members)) return members;
  const details = await careRecipientDetailsModel.lockForGroup(groupId, tx);
  if (isError(details)) return details;
  return applyOrder(tx, currentList(members, details).contacts, members, details);
};

/**
 * Take a member off the list and clear their primary flag: they no longer
 * share a phone with the group. Returns whether they were on it (or primary),
 * so the caller can tell managers. Unchecked, like `renumber`.
 */
export const dropMember = async (tx: Tx, groupId: string, userId: string) => {
  const members = await careGroupMemberModel.lockGroupMembers(groupId, tx);
  if (isError(members)) return members;
  const member = members.find((m) => m.userId === userId);
  if (!member || (member.emergencyRank == null && !member.isPrimaryContact)) return false;

  const res = await careGroupMemberModel.update({
    ...system(tx),
    filter: { id: { type: "eq", value: member.id } },
    // Managers see a note on the profile until they save the list again.
    data: { emergencyRank: null, isPrimaryContact: false, emergencyDroppedAt: new Date().toISOString() },
  });
  if (isError(res)) return res;

  const renumbered = await renumber(tx, groupId);
  if (isError(renumbered)) return renumbered;
  return true;
};

/** Load and lock what a manager's change needs, after checking the actor. */
const forManager = async (ctx: ServiceContext, groupId: string, tx: Tx) => {
  const role = await actorRole(ctx, groupId, tx);
  if (isError(role)) return role;
  if (!role) return notFound();
  if (!canManageEmergencyContacts(role)) return newError({ code: "emergencyContactService:notAllowed" });

  const members = await careGroupMemberModel.lockGroupMembers(groupId, tx);
  if (isError(members)) return members;
  const details = await careRecipientDetailsModel.lockForGroup(groupId, tx);
  if (isError(details)) return details;
  const sharers = await phoneSharers(groupId, tx);
  if (isError(sharers)) return sharers;
  return { members, details, sharers };
};

const noPhone = (index: number) =>
  newError({
    code: "emergencyContactService:noPhone",
    meta: { issues: [{ path: String(index), message: "Doesn't share a phone number with the group" }] },
  });

const notOnList = (index: number, message: string) =>
  newError({ code: "emergencyContactService:invalid", meta: { issues: [{ path: String(index), message }] } });

/**
 * Set the whole emergency list, first to call first (owners and admins).
 * Members must share a phone with the group; outside contacts must exist.
 * Anyone left out is taken off, and any "fell off the list" note is cleared.
 * Returns the stored list and the primary contact.
 */
export const setOrder = (
  ctx: ServiceContext,
  groupId: string,
  input: z.input<typeof emergencyOrderZSchema>,
) =>
  withTransaction(async (tx) => {
    const parsed = emergencyOrderZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const refs = parsed.data;

    const loaded = await forManager(ctx, groupId, tx);
    if (isError(loaded)) return loaded;
    const { members, details, sharers } = loaded;

    for (const [i, ref] of refs.entries()) {
      if (ref.kind === "member") {
        if (!members.some((m) => m.userId === ref.userId)) return notOnList(i, "Not a member of this group");
        if (!sharers.has(ref.userId)) return noPhone(i);
      } else if (!details?.outsideContacts.some((c) => c.id === ref.id)) {
        return notOnList(i, "No such outside contact");
      }
    }

    const applied = await applyOrder(tx, refs, members, details);
    if (applied) return applied;

    // Saving the list answers the "fell off the list" notes.
    for (const member of members) {
      if (!member.emergencyDroppedAt) continue;
      const res = await careGroupMemberModel.update({
        ...system(tx),
        filter: { id: { type: "eq", value: member.id } },
        data: { emergencyDroppedAt: null },
      });
      if (isError(res)) return res;
    }
    return {
      contacts: refs,
      primaryUserId: members.find((m) => m.isPrimaryContact)?.userId ?? null,
    };
  }, ctx);

/**
 * Mark one member as the primary contact providers should call, or none
 * (owners and admins). They must share a phone with the group.
 */
export const setPrimary = (ctx: ServiceContext, groupId: string, userId: string | null) =>
  withTransaction(async (tx) => {
    const loaded = await forManager(ctx, groupId, tx);
    if (isError(loaded)) return loaded;
    const { members, details, sharers } = loaded;

    const target = userId ? members.find((m) => m.userId === userId) : null;
    if (userId && !target) return notOnList(0, "Not a member of this group");
    if (target && !sharers.has(target.userId)) return noPhone(0);

    // Clear the old one first: at most one per group (a unique index).
    for (const member of members) {
      if (!member.isPrimaryContact || member.id === target?.id) continue;
      const res = await careGroupMemberModel.update({
        ...system(tx),
        filter: { id: { type: "eq", value: member.id } },
        data: { isPrimaryContact: false },
      });
      if (isError(res)) return res;
    }
    if (target && !target.isPrimaryContact) {
      const res = await careGroupMemberModel.update({
        ...system(tx),
        filter: { id: { type: "eq", value: target.id } },
        data: { isPrimaryContact: true },
      });
      if (isError(res)) return res;
    }

    return {
      contacts: currentList(members, details).contacts,
      primaryUserId: target?.userId ?? null,
    };
  }, ctx);
