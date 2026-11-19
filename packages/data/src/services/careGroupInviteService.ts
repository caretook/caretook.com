import type { GroupRoleName } from "../constants";
import type { Tx } from "../db";
import type { AppError } from "../errors";
import type { CareGroupInviteModel } from "../models";
import type { ServiceContext, ServiceSelectArgs } from "./types";

import { randomBytes } from "node:crypto";
import { DEFAULT_PAGE_SIZE, SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import { CONSENT_VERSION, emailMatches, INVITE_TTL_DAYS, inviteState } from "../db/schema";
import { isError, newError } from "../errors";
import {
  careGroupConsentModel,
  careGroupInviteModel,
  careGroupMemberModel,
  careGroupModel,
  careRecipientModel,
  userModel,
} from "../models";
import { isSystemUser } from "../permissions";
import * as careGroupMemberService from "./careGroupMemberService";

export const serviceName = "careGroupInvite";
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
 */
export const createEmail = (
  ctx: ServiceContext,
  data: InviteCreateData,
  opts: { mail?: InviteMailer } = {},
) =>
  withTransaction(async (tx) => {
    if (!data.attested) return newError({ code: "careGroupInviteService:notAttested" });
    const refused = await ensureMayInviteRole(ctx, data.groupId, data.role, tx);
    if (refused) return refused;

    // Nothing to invite: they're in already, or an invite is waiting.
    const existing = await userModel.get({
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
 * What a token's holder may know before joining: the invite's state, and
 * while it's usable, the group's display name, the inviter's name, the role
 * and (email invites) the address. Null for a token that matches nothing.
 */
export const preview = async (token: string) => {
  const invite = await careGroupInviteModel.getByToken(token);
  if (isError(invite)) return invite;
  if (!invite) return null;
  const state = inviteState({ invite });
  if (state !== "usable") return { state, invite: null, groupName: null, inviterName: null };
  const groupName = await groupDisplayName(invite.groupId);
  if (isError(groupName)) return groupName;
  const inviterName = await nameOf(invite.consentAttestedBy ?? invite.createdBy);
  if (isError(inviterName)) return inviterName;
  return { state, invite, groupName, inviterName };
};

/**
 * Accept an email invite as the signed-in user, who agreed to CONSENT_TEXT
 * (`consent`). Their email must be the invite's. In one transaction, as the
 * system: the membership with the invite's role, a consent row, the email
 * marked verified (accepting proves the address), and the invite accepted.
 * Accepting again returns the same result.
 */
export const accept = (ctx: ServiceContext, { token, consent }: { token: string; consent: boolean }) =>
  withTransaction(async (tx) => {
    const userId = ctx.authUser?.id;
    if (!userId || isSystemUser(ctx.authUser)) return newError({ code: "permissions:unauthenticated" });
    if (!consent) return newError({ code: "careGroupInviteService:noConsent" });

    const invite = await careGroupInviteModel.getByToken(token, { tx, lock: true });
    if (isError(invite)) return invite;
    if (!invite) return newError({ code: "careGroupInviteService:notFound" });
    if (invite.kind !== "email") return newError({ code: "careGroupInviteService:wrongKind" });

    const user = await userModel.getById(userId, system(tx));
    if (isError(user)) return user;
    if (!user) return newError({ code: "permissions:unauthenticated" });
    if (!emailMatches(invite, user)) return newError({ code: "careGroupInviteService:wrongEmail" });

    const current = await careGroupMemberModel.getRole(invite.groupId, userId, { tx });
    if (isError(current)) return current;

    // Already accepted by this user: the same answer again.
    if (invite.status === "accepted" && invite.acceptedBy === userId) {
      return { groupId: invite.groupId, role: current ?? invite.role };
    }
    const state = inviteState({ invite });
    if (state !== "usable") return newError({ code: "careGroupInviteService:unusable", meta: { state } });

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

    return { groupId: invite.groupId, role: current ?? invite.role };
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
 * For `signUpWithTicket`: the usable email invite behind `token`, or why it
 * can't create an account. Unscoped (the token is the entitlement).
 */
export const ticketFor = async (token: string, tx?: Tx) => {
  const invite = await careGroupInviteModel.getByToken(token, { tx });
  if (isError(invite)) return invite;
  if (!invite || invite.kind !== "email" || inviteState({ invite }) !== "usable" || !invite.email) {
    return newError({ code: "ticket:invalid" });
  }
  return { ...invite, email: invite.email };
};
