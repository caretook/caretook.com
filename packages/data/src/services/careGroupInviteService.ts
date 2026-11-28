import type { GroupRoleName } from "../constants";
import type { Tx } from "../db";
import type { AppError } from "../errors";
import type { CareGroupInviteModel } from "../models";
import type { LinkInviteOptions } from "../db/schema";
import type { JoinMailer } from "./joinRequestService";
import type { ServiceContext, ServiceSelectArgs } from "./types";

import { randomBytes, randomUUID } from "node:crypto";
import { DEFAULT_PAGE_SIZE, hasGroupRole, isManagerRole, OWNER_ROLES, SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import { CONSENT_VERSION, emailMatches, INVITE_TTL_DAYS, inviteState, linkRoleAllowed } from "../db/schema";
import { isError, newError } from "../errors";
import { careGroupConsentModel, careGroupInviteModel, careGroupMemberModel, userModel } from "../models";
import { isSystemUser } from "../permissions";
import { openLinkToken, sealLinkToken } from "../utils/linkToken";
import { getLinkLimits, signupRefusal } from "./appSettingService";
import * as careGroupMemberService from "./careGroupMemberService";
import { groupDisplayName } from "./groupNames";
import * as joinRequestService from "./joinRequestService";
import * as legalAcceptanceService from "./legalAcceptanceService";
import { hasSignUpUse, markSignUpUse } from "./linkSignUpUses";

export { groupDisplayName };

export const schemaName = careGroupInviteModel.schemaName;

type K = typeof schemaName;

export { INVITE_TTL_DAYS };

const system = (tx?: Tx) => ({ authUser: SYSTEM_USER, tx });
const byId = (id: string) => ({ id: { type: "eq" as const, value: id } });

// Reads and deletes go straight to the model (RBAC: group owners and admins).
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

// ---------------------------------------------------------------------------
// Emails
// ---------------------------------------------------------------------------

/** What an invite email says: the new token and the names the invitee will recognise. */
export type InviteEmail = {
  invite: CareGroupInviteModel;
  /** The raw token, for the link. Never stored. */
  token: string;
  /** The group as its members see it: the recipient's preferred name or name, else the group's name. */
  groupName: string;
  inviterName: string | null;
};

/**
 * Queues an invite's email in the service's transaction (the API passes one
 * that calls @caretook/notifications' notify with `tx`), so the invite and its
 * email commit or roll back together. Returns the outbox row's id, to deliver
 * after commit.
 */
export type InviteMailer = (email: InviteEmail, tx: Tx) => Promise<{ id: string } | AppError>;

const newToken = () => randomBytes(32).toString("base64url");
const expiryFromNow = () => new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

/** A user's display name, or null. Unscoped: only for names shown to someone entitled to them. */
const nameOf = async (userId: string | null, tx?: Tx) => {
  if (!userId) return null;
  const user = await userModel.getById(userId, system(tx));
  if (isError(user)) return user;
  return user?.name?.trim() || null;
};

const sendInvite = async (
  invite: CareGroupInviteModel,
  token: string,
  inviterId: string | null,
  tx: Tx,
  mail: InviteMailer | undefined,
) => {
  if (!mail) return null;
  const groupName = await groupDisplayName(invite.groupId, tx);
  if (isError(groupName)) return groupName;
  const inviterName = await nameOf(inviterId, tx);
  if (isError(inviterName)) return inviterName;
  const queued = await mail({ invite, token, groupName, inviterName }, tx);
  if (isError(queued)) return queued;
  return queued.id;
};

// ---------------------------------------------------------------------------
// Inviting
// ---------------------------------------------------------------------------

/** The actor's role in `groupId` (owner for the system), or null. */
const actorRole = async (ctx: ServiceContext, groupId: string, tx: Tx) => {
  if (isSystemUser(ctx.authUser)) return "owner" as const;
  if (!ctx.authUser) return null;
  return careGroupMemberModel.getRole(groupId, ctx.authUser.id, { tx });
};

/** Only an owner may invite (or re-invite) an owner. */
const ensureMayInviteRole = async (ctx: ServiceContext, groupId: string, role: GroupRoleName, tx: Tx) => {
  if (role !== "owner") return null;
  const mine = await actorRole(ctx, groupId, tx);
  if (isError(mine)) return mine;
  return mine === "owner" ? null : newError({ code: "careGroupInviteService:ownerOnly" });
};

export type InviteCreateData = {
  groupId: string;
  email: string;
  role: GroupRoleName;
  /**
   * The inviter confirms the care recipient (or their representative) agreed
   * to share with this person (ATTESTATION_TEXT). Required: the invite
   * records who confirmed it, when, and the consent version.
   */
  attested: boolean;
};

/**
 * Invite someone to a group by email (owners and admins; only owners invite
 * owners). Returns the invite, its raw token (for the link; it isn't stored
 * and can't be read back) and the queued email's outbox id, if `mail` was given.
 * Refused while `signup.emailInvites` is off, unless `staffInvite` is set: the
 * staff owner invites (groupAdminService.inviteOwner and
 * staffGroupService.createWithOwnerInvite) aren't members' invites, so the
 * switch doesn't apply to them. The API never sets it.
 */
export const createEmail = (
  ctx: ServiceContext,
  data: InviteCreateData,
  opts: { mail?: InviteMailer; staffInvite?: boolean } = {},
) =>
  withTransaction(async (tx) => {
    if (!opts.staffInvite) {
      const closed = await signupRefusal("emailInvites");
      if (closed) return closed;
    }
    if (!data.attested) return newError({ code: "careGroupInviteService:notAttested" });
    const refused = await ensureMayInviteRole(ctx, data.groupId, data.role, tx);
    if (refused) return refused;

    // Nothing to invite: they're in already, or an invite is waiting.
    const existing = await userModel.getWhole({
      ...system(tx),
      filter: { email: { type: "eq", value: userModel.normalizeEmail(data.email) } },
    });
    if (isError(existing)) return existing;
    if (existing) {
      const role = await careGroupMemberModel.getRole(data.groupId, existing.id, { tx });
      if (isError(role)) return role;
      if (role) return newError({ code: "careGroupInviteService:alreadyMember" });
    }
    const waiting = await careGroupInviteModel.get({
      ...system(tx),
      filter: {
        groupId: { type: "eq", value: data.groupId },
        email: { type: "eq", value: userModel.normalizeEmail(data.email) },
        status: { type: "eq", value: "pending" },
      },
    });
    if (isError(waiting)) return waiting;

    const token = newToken();
    const inviterId = isSystemUser(ctx.authUser) ? null : (ctx.authUser?.id ?? null);
    const fields = {
      tokenHash: careGroupInviteModel.hashInviteToken(token),
      expiresAt: expiryFromNow(),
      consentAttestedBy: inviterId,
      consentAttestedAt: new Date().toISOString(),
      consentVersion: CONSENT_VERSION,
    };

    // An expired invite to the same address is replaced, as a resend would.
    if (waiting) {
      if (!waiting.isExpired) return newError({ code: "careGroupInviteService:alreadyInvited" });
      const revoked = await careGroupInviteModel.update({
        ...system(tx),
        filter: byId(waiting.id),
        data: { status: "revoked", respondedAt: new Date().toISOString() },
      });
      if (isError(revoked)) return revoked;
    }

    // Created in the actor's scope: the permissions map decides who may invite.
    const invite = await careGroupInviteModel.create({
      ...ctx,
      tx,
      data: { groupId: data.groupId, email: data.email, role: data.role, kind: "email", ...fields },
    });
    if (isError(invite)) return invite;
    if (!invite) return newError({ code: "careGroupInviteService:notFound" });

    const queued = await sendInvite(invite, token, inviterId, tx, opts.mail);
    if (isError(queued)) return queued;
    return { invite, token, queued };
  }, ctx);

/**
 * Send a pending email invite again with a new link. The old link stops
 * working, and the 7 days start again.
 */
export const resend = (ctx: ServiceContext, id: string, opts: { mail?: InviteMailer } = {}) =>
  withTransaction(async (tx) => {
    const closed = await signupRefusal("emailInvites");
    if (closed) return closed;
    // Read in the actor's scope: only the group's owners and admins see it.
    const current = await careGroupInviteModel.getById(id, { ...ctx, tx });
    if (isError(current)) return current;
    if (!current || current.status !== "pending")
      return newError({ code: "careGroupInviteService:notFound" });
    if (current.kind !== "email") return newError({ code: "careGroupInviteService:wrongKind" });
    const refused = await ensureMayInviteRole(ctx, current.groupId, current.role, tx);
    if (refused) return refused;

    const token = newToken();
    const updated = await careGroupInviteModel.update({
      ...system(tx),
      filter: byId(id),
      data: { tokenHash: careGroupInviteModel.hashInviteToken(token), expiresAt: expiryFromNow() },
    });
    if (isError(updated)) return updated;
    const [invite] = updated;
    if (!invite) return newError({ code: "careGroupInviteService:notFound" });

    const inviterId = isSystemUser(ctx.authUser) ? null : (ctx.authUser?.id ?? null);
    const queued = await sendInvite(invite, token, inviterId, tx, opts.mail);
    if (isError(queued)) return queued;
    return { invite, token, queued };
  }, ctx);

/**
 * Make an invite link (owners and admins): a role of caretaker or viewer
 * only, an expiry (the `invites.linkDefaultDays` setting when none is given,
 * at most `invites.linkMaxDays`) and an optional maximum number of uses (at
 * most `invites.linkMaxUses`). Refused while invite links are switched off.
 * Anyone with it may ask to join, and an owner or admin approves each
 * request. Its token is returned now and kept sealed (INVITE_LINK_KEY), so
 * `copyLink` can give it again while the link is active.
 */
export const createLink = (ctx: ServiceContext, data: { groupId: string } & LinkInviteOptions) =>
  withTransaction(async (tx) => {
    const closed = await signupRefusal("linkInvites");
    if (closed) return closed;
    if (!linkRoleAllowed(data.role)) return newError({ code: "careGroupInviteService:linkRole" });
    const mine = await actorRole(ctx, data.groupId, tx);
    if (isError(mine)) return mine;
    if (mine !== "owner" && mine !== "admin") return newError({ code: "careGroupInviteService:notAllowed" });

    const id = randomUUID();
    const token = newToken();
    const sealed = sealLinkToken(token, id);
    if (!sealed) return newError({ code: "careGroupInviteService:linkKeyMissing" });
    const limits = await getLinkLimits();
    const days = data.expiresInDays ?? limits.defaultDays;
    if (days > limits.maxDays) {
      const message = `At most ${limits.maxDays} days`;
      return newError({
        code: "careGroupInviteService:linkTooLong",
        meta: { issues: [{ path: "expiresInDays", message }] },
      });
    }
    if (data.maxUses != null && data.maxUses > limits.maxUses) {
      const message = `At most ${limits.maxUses}, or no limit`;
      return newError({
        code: "careGroupInviteService:tooManyUses",
        meta: { issues: [{ path: "maxUses", message }] },
      });
    }
    const invite = await careGroupInviteModel.create({
      ...ctx,
      tx,
      data: {
        id,
        groupId: data.groupId,
        kind: "link",
        email: null,
        role: data.role,
        tokenHash: careGroupInviteModel.hashInviteToken(token),
        tokenCiphertext: sealed,
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
        maxUses: data.maxUses ?? null,
      },
    });
    if (isError(invite)) return invite;
    if (!invite) return newError({ code: "careGroupInviteService:notFound" });
    return { invite, token };
  }, ctx);

/**
 * An active link's token again, for its group's owners and admins (to copy
 * or share it). Expired, used-up and withdrawn links give nothing, and an
 * email invite's token can never be read back: only its hash is kept.
 */
export const copyLink = async (ctx: ServiceContext, id: string) => {
  // Read in the actor's scope: only the group's owners and admins see it.
  const invite = await careGroupInviteModel.getById(id, ctx);
  if (isError(invite)) return invite;
  if (!invite) return newError({ code: "careGroupInviteService:notFound" });
  if (invite.kind !== "link") return newError({ code: "careGroupInviteService:notLink" });
  if (inviteState({ invite }) !== "usable") return newError({ code: "careGroupInviteService:linkInactive" });
  const sealed = await careGroupInviteModel.getSealedToken(id);
  if (isError(sealed)) return sealed;
  const token = sealed ? openLinkToken(sealed, id) : null;
  if (!token) return newError({ code: "careGroupInviteService:linkKeyMissing" });
  return { invite, token };
};

/** Withdraw a pending invite. Its link stops working at once. */
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

// ---------------------------------------------------------------------------
// The invitee: holding the token is what entitles them to these.
// ---------------------------------------------------------------------------

/**
 * A staff owner invite (groupAdminService.inviteOwner or
 * staffGroupService.createWithOwnerInvite): an owner email invite created by
 * the system, which only those two paths do (members' invites are created in
 * their own scope, so `createdBy` is the member).
 */
const isStaffOwnerInvite = (invite: { kind: string; role: string; createdBy: string }) =>
  invite.kind === "email" && invite.role === "owner" && invite.createdBy === SYSTEM_USER.id;

/**
 * `settings:signupClosed` while the invite's kind (email or link) is switched
 * off, else null. Staff owner invites aren't members' invites, so the email
 * switch doesn't apply to them.
 */
const kindRefusal = async (invite: { kind: string; role: string; createdBy: string }) =>
  isStaffOwnerInvite(invite) ? null : signupRefusal(invite.kind === "link" ? "linkInvites" : "emailInvites");

/**
 * Whether the invite's maker may still make it: a member's invite or link
 * works only while they're in the group in a role that may make it (an owner
 * for an owner invite, else an owner or admin). Leaving, removal and
 * demotion revoke them (careGroupMemberService); this catches any made
 * before that, or left behind by a change that skipped the service. Invites
 * the system made (staff's owner invites) are exempt.
 */
const makerMayStill = async (
  invite: { groupId: string; role: GroupRoleName; createdBy: string },
  tx?: Tx,
): Promise<boolean | AppError> => {
  if (invite.createdBy === SYSTEM_USER.id) return true;
  const role = await careGroupMemberModel.getRole(invite.groupId, invite.createdBy, { tx });
  if (isError(role)) return role;
  return hasGroupRole(OWNER_ROLES, invite.role) ? hasGroupRole(OWNER_ROLES, role) : isManagerRole(role);
};

/**
 * The invite's state with its maker rechecked: a usable invite whose maker
 * may no longer make it reads as revoked, the same answer a withdrawn one gets.
 */
const currentState = async (invite: CareGroupInviteModel, tx?: Tx) => {
  const state = inviteState({ invite });
  if (state !== "usable") return state;
  const may = await makerMayStill(invite, tx);
  if (isError(may)) return may;
  return may ? state : ("revoked" as const);
};

/**
 * What a token's holder may know before joining: the invite's state, and
 * while it's usable, the group's display name, the inviter's name, the role
 * and (email invites) the address. Null for a token that matches nothing.
 * `unavailable` while its kind is switched off (admin settings).
 */
export const preview = async (token: string) => {
  const invite = await careGroupInviteModel.getByToken(token);
  if (isError(invite)) return invite;
  if (!invite) return null;
  const state = await currentState(invite);
  if (isError(state)) return state;
  if (state !== "usable") return { state, invite: null, groupName: null, inviterName: null };
  // Its kind switched off (admin settings): say so, and nothing about the group.
  if (await kindRefusal(invite))
    return { state: "unavailable" as const, invite: null, groupName: null, inviterName: null };
  const groupName = await groupDisplayName(invite.groupId);
  if (isError(groupName)) return groupName;
  const inviterName = await nameOf(invite.consentAttestedBy ?? invite.createdBy);
  if (isError(inviterName)) return inviterName;
  return { state, invite, groupName, inviterName };
};

/** What accepting an invite did: joined the group, or asked to (a link). */
export type AcceptResult =
  | { status: "joined"; groupId: string; role: GroupRoleName; queued: string[] }
  | { status: "requested"; groupId: string; role: GroupRoleName; requestId: string; queued: string[] };

const joined = (groupId: string, role: GroupRoleName): AcceptResult => ({
  status: "joined",
  groupId,
  role,
  queued: [],
});

/**
 * Before a new join or join request: an account with a current acceptance
 * passes and writes nothing; without one, `legal` records it in this
 * transaction, and its absence is `legalRequired`.
 */
const ensureLegal = async (userId: string, legal: boolean | undefined, tx: Tx) => {
  const current = await legalAcceptanceService.hasCurrent(userId, tx);
  if (isError(current)) return current;
  if (current) return null;
  if (!legal) return newError({ code: "careGroupInviteService:legalRequired" });
  const recorded = await legalAcceptanceService.record(tx, { userId, source: "invite_accept" });
  return isError(recorded) ? recorded : null;
};

/**
 * Using a link: a member already is one; anyone else gets a pending join
 * request (one per person: asking again returns it), which an owner or admin
 * approves. Until then they see nothing of the group. Only a new request
 * asks for the legal acceptance.
 */
const askWithLink = async (
  invite: CareGroupInviteModel,
  userId: string,
  legal: boolean | undefined,
  tx: Tx,
  mail: JoinMailer | undefined,
): Promise<AcceptResult | AppError> => {
  const current = await careGroupMemberModel.getRole(invite.groupId, userId, { tx });
  if (isError(current)) return current;
  if (current) return joined(invite.groupId, current);
  // A request already waiting is still waiting, even once the link has closed.
  const waiting = await joinRequestService.requestWithLink({ invite, userId }, tx, mail, {
    existingOnly: true,
  });
  if (isError(waiting)) return waiting;
  if (waiting) return requested(waiting.request);
  const state = await linkStateFor(invite, userId, tx);
  if (isError(state)) return state;
  const closed = await kindRefusal(invite);
  if (closed) return closed;
  if (state !== "usable") return newError({ code: "careGroupInviteService:unusable", meta: { state } });
  const refused = await ensureLegal(userId, legal, tx);
  if (refused) return refused;
  const asked = await joinRequestService.requestWithLink({ invite, userId }, tx, mail);
  if (isError(asked)) return asked;
  if (!asked) return newError({ code: "careGroupInviteService:notFound" });
  return { ...requested(asked.request), queued: asked.queued };
};

/**
 * A link's state for `userId`'s join request. A link used up by sign-ups is
 * still usable for someone whose own sign-up through it took one of those
 * uses (`useLinkForSignUp`): their request counts nothing more.
 */
const linkStateFor = async (invite: CareGroupInviteModel, userId: string, tx: Tx) => {
  if (inviteState({ invite }) === "usedUp") {
    const user = await userModel.getWholeById(userId, system(tx));
    if (isError(user)) return user;
    if (user && (await hasSignUpUse(tx, invite.id, user.email))) {
      const may = await makerMayStill(invite, tx);
      if (isError(may)) return may;
      return may ? ("usable" as const) : ("revoked" as const);
    }
  }
  return currentState(invite, tx);
};

const requested = (request: { id: string; groupId: string; role: GroupRoleName }): AcceptResult => ({
  status: "requested",
  groupId: request.groupId,
  role: request.role,
  requestId: request.id,
  queued: [],
});

/**
 * Accept an invite as the signed-in user, who agreed to CONSENT_TEXT
 * (`consent`). For an email invite their email must be the invite's. In one
 * transaction, as the system: the membership with the invite's role, a
 * consent row, the email marked verified (accepting proves the address), and
 * the invite accepted. Accepting again returns the same result. For a link,
 * it asks to join instead (`askWithLink`), emailing owners and admins
 * through `joinMail`. An account without a current legal acceptance must
 * give `legal`, recorded in the same transaction (`legalRequired` otherwise).
 */
export const accept = (
  ctx: ServiceContext,
  { token, consent, legal }: { token: string; consent: boolean; legal?: boolean },
  opts: { joinMail?: JoinMailer } = {},
) =>
  withTransaction(async (tx) => {
    const userId = ctx.authUser?.id;
    if (!userId || isSystemUser(ctx.authUser)) return newError({ code: "permissions:unauthenticated" });
    if (!consent) return newError({ code: "careGroupInviteService:noConsent" });

    const invite = await careGroupInviteModel.getByToken(token, { tx, lock: true });
    if (isError(invite)) return invite;
    if (!invite) return newError({ code: "careGroupInviteService:notFound" });
    if (invite.kind === "link") return askWithLink(invite, userId, legal, tx, opts.joinMail);

    const user = await userModel.getWholeById(userId, system(tx));
    if (isError(user)) return user;
    if (!user) return newError({ code: "permissions:unauthenticated" });
    if (!emailMatches(invite, user)) return newError({ code: "careGroupInviteService:wrongEmail" });

    const current = await careGroupMemberModel.getRole(invite.groupId, userId, { tx });
    if (isError(current)) return current;

    // Already accepted by this user: the same answer again.
    if (invite.status === "accepted" && invite.acceptedBy === userId) {
      return joined(invite.groupId, current ?? invite.role);
    }
    const state = await currentState(invite, tx);
    if (isError(state)) return state;
    if (state !== "usable") return newError({ code: "careGroupInviteService:unusable", meta: { state } });
    const closed = await kindRefusal(invite);
    if (closed) return closed;
    const refused = await ensureLegal(userId, legal, tx);
    if (refused) return refused;

    if (!current) {
      const member = await careGroupMemberService.create(system(tx), {
        groupId: invite.groupId,
        userId,
        role: invite.role,
        invitedBy: invite.consentAttestedBy,
      });
      if (isError(member)) return member;
    }

    const consented = await careGroupConsentModel.create({
      ...system(tx),
      data: {
        groupId: invite.groupId,
        userId,
        kind: "joiner",
        consentVersion: CONSENT_VERSION,
        inviteId: invite.id,
      },
    });
    if (isError(consented)) return consented;

    if (!user.emailVerified) {
      const verified = await userModel.update({
        ...system(tx),
        filter: byId(userId),
        data: { emailVerified: true },
      });
      if (isError(verified)) return verified;
    }

    const accepted = await careGroupInviteModel.update({
      ...system(tx),
      filter: byId(invite.id),
      data: { status: "accepted", acceptedBy: userId, respondedAt: new Date().toISOString() },
    });
    if (isError(accepted)) return accepted;

    return joined(invite.groupId, current ?? invite.role);
  }, ctx);

/**
 * Decline an email invite. Anyone holding the link may, signed in or not
 * (the invited person may have no account), so the inviter sees it declined.
 */
export const decline = (token: string) =>
  withTransaction(async (tx) => {
    const invite = await careGroupInviteModel.getByToken(token, { tx, lock: true });
    if (isError(invite)) return invite;
    if (!invite) return newError({ code: "careGroupInviteService:notFound" });
    if (invite.kind !== "email") return newError({ code: "careGroupInviteService:wrongKind" });
    if (invite.status === "declined") return { groupId: invite.groupId };
    const state = inviteState({ invite });
    if (state !== "usable") return newError({ code: "careGroupInviteService:unusable", meta: { state } });
    const declined = await careGroupInviteModel.update({
      ...system(tx),
      filter: byId(invite.id),
      data: { status: "declined", respondedAt: new Date().toISOString() },
    });
    if (isError(declined)) return declined;
    return { groupId: invite.groupId };
  });

/**
 * For `signUpWithTicket`: the usable invite behind `token` (an email invite,
 * whose address the account must use, or a link), or why it can't create an
 * account. Unscoped (the token is the entitlement).
 */
export const ticketFor = async (token: string, tx?: Tx) => {
  const invite = await careGroupInviteModel.getByToken(token, { tx });
  if (isError(invite)) return invite;
  if (!invite) return newError({ code: "ticket:invalid" });
  const state = await currentState(invite, tx);
  if (isError(state)) return state;
  if (state !== "usable") return newError({ code: "ticket:invalid" });
  const closed = await kindRefusal(invite);
  if (closed) return closed;
  if (invite.kind === "email" && !invite.email) return newError({ code: "ticket:invalid" });
  return invite;
};

/**
 * A link's sign-up counts a use toward its `max_uses` (B-333), with the
 * link's row locked so two sign-ups can't both take its last use. An address
 * whose sign-up through this link already counted counts nothing more (a
 * second try, or its later join request: `joinRequestService` takes the
 * marker instead of counting). A link that's no longer usable, or not a
 * link, is `ticket:invalid`, as `ticketFor` says. Called for a new address
 * and one with an account alike, so the two answer the same.
 */
export const useLinkForSignUp = (token: string, email: string) =>
  withTransaction(async (tx) => {
    const invite = await careGroupInviteModel.getByToken(token, { tx, lock: true });
    if (isError(invite)) return invite;
    if (!invite || invite.kind !== "link") return newError({ code: "ticket:invalid" });
    if (await hasSignUpUse(tx, invite.id, email)) return { counted: false };
    const state = await currentState(invite, tx);
    if (isError(state)) return state;
    if (state !== "usable") return newError({ code: "ticket:invalid" });
    const used = await careGroupInviteModel.update({
      ...system(tx),
      filter: byId(invite.id),
      data: { useCount: invite.useCount + 1 },
    });
    if (isError(used)) return used;
    await markSignUpUse(tx, invite.id, email, invite.expiresAt);
    return { counted: true };
  });
