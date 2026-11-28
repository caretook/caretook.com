import type { AuthUser, CareGroupInviteModel, InviteMailer } from "@caretook/data";

import { createHash } from "node:crypto";
import { signUpWithTicket } from "@caretook/auth";
import {
  appSettingService,
  careGroupInviteService,
  careGroupMemberService,
  GROUP_MANAGER_ROLES,
  GROUP_ROLE_NAMES,
  inviteEmailZ,
  inviteState,
  isError,
  legalAcceptanceService,
  linkInviteOptionsZ,
  SYSTEM_USER,
  userService,
} from "@caretook/data";
import { deliverSoon, notify } from "@caretook/notifications";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { iso } from "../dto";
import { unwrap } from "../errors";
import { joinMailer } from "./joinRequests";
import { authedProcedure, optionalAuthUser, publicProcedure } from "../procedures";

// `invite.*`: care group invites by email (invites slice 3) and by link
// (slice 4). Managers (owners and admins) list, send, resend and revoke
// them; the person invited previews, signs up, accepts or declines with the
// token from their email or link. Every email is queued in the same
// transaction as its change and delivered after commit. An email invite's
// raw token is only ever in the email: no procedure returns one. A link's
// token is returned to managers (createLink, copyLink) while it's active.

const id = z.uuid();
/** Invite tokens are 32 random bytes, base64url. */
const token = z
  .string()
  .min(20)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/);

/** Declined invites stay in the list this long, so the inviter sees the answer. */
const DECLINED_SHOWN_DAYS = 30;

const hashed = (value: string) => createHash("sha256").update(value).digest("base64url");

/** Queues `groupInvite` in the service's transaction. */
const inviteMailer =
  (actorId: string): InviteMailer =>
  ({ invite, token: raw, groupName, inviterName }, tx) => {
    if (!invite.email) throw new Error("An email invite without an email");
    return notify("groupInvite", {
      to: invite.email,
      actor: { id: actorId },
      data: { groupName, ...(inviterName ? { inviterName } : {}), role: invite.role, token: raw },
      idempotencyKey: `groupInvite:${invite.id}:${hashed(raw)}`,
      tx,
    });
  };

/** The actor's role in the group: a 404 for non-members, a 403 for members who don't manage it. */
const requireManager = async (context: { authUser: AuthUser }, groupId: string) => {
  const authUser = context.authUser;
  const membership = unwrap(
    await careGroupMemberService.get(context, {
      filter: { groupId: { type: "eq", value: groupId }, userId: { type: "eq", value: authUser.id } },
    }),
  );
  if (!membership) throw new ORPCError("NOT_FOUND");
  if (!GROUP_MANAGER_ROLES.some((role) => role === membership.role)) throw new ORPCError("FORBIDDEN");
  return membership.role;
};

/** Names of the given users, for "sent by". Public profile fields only. */
const namesOf = async (userIds: (string | null)[]) => {
  const ids = [...new Set(userIds.filter((u): u is string => !!u && u !== SYSTEM_USER.id))];
  if (!ids.length) return new Map<string, string | null>();
  const users = unwrap(
    await userService.list(
      { authUser: SYSTEM_USER },
      { filter: { id: { type: "inArray", value: ids } }, paginate: { page: 1, limit: 100 } },
    ),
  ).data;
  return new Map(users.map((u) => [u.id, u.name?.trim() || null]));
};

/** An invite as managers see it: never its token or hash. */
const toInvite = (invite: CareGroupInviteModel, names: Map<string, string | null>) => {
  const sentBy = invite.consentAttestedBy ?? invite.createdBy;
  return {
    id: invite.id,
    groupId: invite.groupId,
    kind: invite.kind,
    email: invite.email,
    role: invite.role,
    status: invite.status,
    state: inviteState({ invite }),
    expiresAt: iso(invite.expiresAt),
    createdAt: iso(invite.createdAt),
    respondedAt: invite.respondedAt ? iso(invite.respondedAt) : null,
    sentBy: sentBy === SYSTEM_USER.id ? null : { userId: sentBy, name: names.get(sentBy) ?? null },
    maxUses: invite.maxUses,
    useCount: invite.useCount,
  };
};

export type InviteDto = ReturnType<typeof toInvite>;

const one = async (invite: CareGroupInviteModel) =>
  toInvite(invite, await namesOf([invite.consentAttestedBy ?? invite.createdBy]));

export const invite = {
  /**
   * A group's waiting email invites (expired ones included, so they can be
   * sent again) and the ones declined in the last 30 days, newest first.
   * Owners and admins; other members get a 403, non-members a 404.
   */
  listForGroup: authedProcedure.input(z.object({ groupId: id })).handler(async ({ context, input }) => {
    await requireManager(context, input.groupId);
    const rows = unwrap(
      await careGroupInviteService.list(context, {
        filter: {
          groupId: { type: "eq", value: input.groupId },
          kind: { type: "eq", value: "email" },
          status: { type: "inArray", value: ["pending", "declined"] },
        },
        paginate: { page: 1, limit: 100 },
      }),
    ).data;
    const since = Date.now() - DECLINED_SHOWN_DAYS * 24 * 60 * 60 * 1000;
    const shown = rows
      .filter((r) => r.status === "pending" || new Date(r.respondedAt ?? r.updatedAt).getTime() >= since)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const names = await namesOf(shown.map((r) => r.consentAttestedBy ?? r.createdBy));
    return shown.map((r) => toInvite(r, names));
  }),

  /**
   * Invite someone by email (owners and admins; only owners invite owners).
   * `attested`: the inviter confirms the care recipient agreed to share.
   */
  createEmail: authedProcedure
    .input(
      z.object({
        groupId: id,
        email: inviteEmailZ,
        role: z.enum(GROUP_ROLE_NAMES),
        attested: z.literal(true),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireManager(context, input.groupId);
      const created = unwrap(
        await careGroupInviteService.createEmail(context, input, { mail: inviteMailer(context.authUser.id) }),
      );
      if (created.queued) deliverSoon(created.queued);
      return one(created.invite);
    }),

  /** Send a waiting email invite again, with a new link (the old one stops working). */
  resend: authedProcedure.input(z.object({ id })).handler(async ({ context, input }) => {
    const sent = unwrap(
      await careGroupInviteService.resend(context, input.id, { mail: inviteMailer(context.authUser.id) }),
    );
    if (sent.queued) deliverSoon(sent.queued);
    return one(sent.invite);
  }),

  /** Withdraw a waiting invite: its link stops working at once. */
  revoke: authedProcedure.input(z.object({ id })).handler(async ({ context, input }) => {
    const revoked = unwrap(await careGroupInviteService.revoke(context, input.id));
    return one(revoked);
  }),

  /**
   * A group's invite links that haven't been revoked (expired and used-up
   * ones too, so they can be revoked), newest first. Owners and admins.
   * No tokens: `copyLink` gives an active one.
   */
  listLinks: authedProcedure.input(z.object({ groupId: id })).handler(async ({ context, input }) => {
    await requireManager(context, input.groupId);
    const rows = unwrap(
      await careGroupInviteService.list(context, {
        filter: {
          groupId: { type: "eq", value: input.groupId },
          kind: { type: "eq", value: "link" },
          status: { type: "eq", value: "pending" },
        },
        paginate: { page: 1, limit: 100 },
      }),
    ).data.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const names = await namesOf(rows.map((r) => r.createdBy));
    return rows.map((r) => toInvite(r, names));
  }),

  /**
   * Make an invite link (owners and admins): caretaker or viewer only, an
   * expiry within the `invites.link*` settings (their default when none is
   * given), and an optional maximum number of uses. Returns the link's
   * token, to share at once.
   */
  createLink: authedProcedure
    .input(linkInviteOptionsZ.extend({ groupId: id }))
    .handler(async ({ context, input }) => {
      await requireManager(context, input.groupId);
      const created = unwrap(await careGroupInviteService.createLink(context, input));
      return { invite: await one(created.invite), token: created.token };
    }),

  /** An active link's token again (owners and admins), to copy or share. Never an email invite's. */
  copyLink: authedProcedure.input(z.object({ id })).handler(async ({ context, input }) => {
    const found = unwrap(await careGroupInviteService.copyLink(context, input.id));
    return { id: found.invite.id, token: found.token };
  }),

  /**
   * What the invite link's holder sees before joining. A usable invite gives
   * the group's display name, the inviter's name, the role and the address
   * it was sent to; anything else gives only its state, never the group.
   */
  preview: publicProcedure.input(z.object({ token })).handler(async ({ context, input }) => {
    // The session is looked up only for a used-up link (the service says why).
    const viewerId = async () => (await optionalAuthUser(context))?.id;
    const found = unwrap(await careGroupInviteService.preview(input.token, { viewerId }));
    if (!found) return { state: "notFound" as const };
    if (found.state !== "usable" || !found.invite) return { state: found.state };
    return {
      state: "usable" as const,
      kind: found.invite.kind,
      role: found.invite.role,
      email: found.invite.email,
      groupName: found.groupName,
      inviterName: found.inviterName,
      expiresAt: iso(found.invite.expiresAt),
    };
  }),

  /**
   * Create an account from an invite. An email invite's address must be the
   * invite's, and the account starts verified: the client then signs in with
   * the password and accepts. A link takes any address, and the account
   * starts unverified (`verified: false`): the client sends the
   * confirmation email, and the person asks to join once confirmed. Through
   * a link, an address that already has an account gets the same answer.
   */
  signUp: publicProcedure
    .input(
      z.object({
        token,
        name: z.string().trim().min(1).max(100),
        email: z.email().max(254),
        password: z.string().min(1).max(256),
        legal: z.literal(true),
      }),
    )
    .handler(async ({ context, input }) => {
      const user = unwrap(
        await signUpWithTicket(
          {
            ticket: { kind: "invite", token: input.token, legal: input.legal },
            name: input.name,
            email: input.email,
            password: input.password,
          },
          // A link's sign-up is limited per client IP (and per link).
          { clientIp: context.clientIp },
        ),
      );
      return { email: user.email, verified: user.emailVerified };
    }),

  /**
   * Join the group as the signed-in user, who agreed to CONSENT_TEXT. Their
   * email must be the invite's. Accepting twice is fine. With a link it asks
   * to join instead (`status: "requested"`), and the group's owners and
   * admins are emailed; asking twice returns the same request. `legal`: they
   * ticked the legal box, which an account with no current acceptance must
   * (`legalRequired`).
   */
  accept: authedProcedure
    .input(z.object({ token, consent: z.literal(true), legal: z.literal(true).optional() }))
    .handler(async ({ context, input }) => {
      const result = unwrap(await careGroupInviteService.accept(context, input, { joinMail: joinMailer() }));
      if (result.queued.length) deliverSoon(result.queued);
      return { status: result.status, groupId: result.groupId, role: result.role };
    }),

  /** Whether the signed-in person still has to agree to the current legal versions. */
  legalNeeded: authedProcedure.handler(async ({ context }) => ({
    needed: !unwrap(await legalAcceptanceService.hasCurrent(context.authUser.id)),
  })),

  /**
   * What the Members page's invite controls may offer (owners and admins):
   * whether email invites and invite links are switched on (admin settings),
   * and the limits a new link follows.
   */
  options: authedProcedure.input(z.object({ groupId: id })).handler(async ({ context, input }) => {
    await requireManager(context, input.groupId);
    const settings = await appSettingService.getSettings();
    return {
      emailInvites: settings["signup.emailInvites"],
      linkInvites: settings["signup.linkInvites"],
      link: await appSettingService.getLinkLimits(),
    };
  }),

  /** Say no. Anyone with the link may, signed in or not. */
  decline: publicProcedure.input(z.object({ token })).handler(async ({ input }) => {
    const declined = await careGroupInviteService.decline(input.token);
    if (isError(declined)) unwrap(declined);
    return { ok: true as const };
  }),
};
