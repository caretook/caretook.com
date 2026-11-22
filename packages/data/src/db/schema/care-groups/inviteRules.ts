// The rules for care group invites, shared by the server (careGroupInviteService)
// and screens (the Members page, /invite/:token). Pure and client-safe; the
// server stays the authority.

import type { GroupRoleName } from "../../../constants/roles";

import { z } from "zod";
import {
  GROUP_ROLE_NAMES,
  OWNER_ROLES,
  hasGroupRole,
  isGroupRoleName,
  isManagerRole,
} from "../../../constants/roles";

export const INVITE_KINDS = ["email", "link"] as const;
export type InviteKind = (typeof INVITE_KINDS)[number];

/** How long an emailed invite works, from when it's sent (or sent again). */
export const INVITE_TTL_DAYS = 7;

/**
 * What the person joining agrees to, shown beside the checkbox on
 * /invite/:token and recorded (by version) on their consent row. Change the
 * text and the version together: a recorded version must always mean the
 * words that person saw.
 */
export const CONSENT_VERSION = "2026-11-18";
export const CONSENT_TEXT =
  "I understand this care group shares the care recipient's health information with me: their timeline, notes, vitals, medications and providers. I'll keep it private and use it only to help with their care.";

/**
 * What the inviter confirms before an email invite is sent; the invite
 * records who confirmed and when, with the consent version.
 */
export const ATTESTATION_TEXT =
  "The care recipient (or the person who speaks for them) agreed to share their health information with this person.";

/** What a care group shares with a new member, as a list for the consent screen. */
export const SHARED_WITH_MEMBERS = ["Timeline", "Notes", "Vitals", "Medications", "Providers"] as const;

/**
 * Link invites can make caretakers, viewers and the two easy roles only, so
 * a leaked link never makes an owner or admin.
 */
export const LINK_ROLES = [
  "caretaker",
  "viewer",
  "easy_helper",
  "easy_viewer",
] as const satisfies readonly GroupRoleName[];
export type LinkRole = (typeof LINK_ROLES)[number];

export const linkRoleAllowed = (role: string): boolean => LINK_ROLES.some((allowed) => allowed === role);

/**
 * Whether a member with `actorRole` may invite someone as `targetRole`.
 * Owners and admins invite; only owners invite owners (by email: a link can
 * never grant owner or admin).
 */
export const canInvite = ({
  actorRole,
  targetRole,
  kind,
}: {
  actorRole: string | null | undefined;
  targetRole: string;
  kind: InviteKind;
}): boolean => {
  if (!isManagerRole(actorRole)) return false;
  if (kind === "link") return linkRoleAllowed(targetRole);
  if (hasGroupRole(OWNER_ROLES, targetRole)) return hasGroupRole(OWNER_ROLES, actorRole);
  return isGroupRoleName(targetRole);
};

/** The roles a member with `actorRole` may pick for an invite of `kind`, highest first. */
export const invitableRoles = (actorRole: string | null | undefined, kind: InviteKind): GroupRoleName[] =>
  GROUP_ROLE_NAMES.filter((role) => canInvite({ actorRole, targetRole: role, kind }));

export const INVITE_STATES = ["usable", "expired", "revoked", "usedUp", "accepted", "declined"] as const;
export type InviteState = (typeof INVITE_STATES)[number];

/** The parts of an invite its state depends on. */
export type InviteStateInput = {
  status: string;
  expiresAt: string | Date;
  maxUses?: number | null;
  useCount?: number | null;
};

/**
 * Whether an invite can be used `now`. A finished status wins over expiry
 * (an accepted invite says "accepted", not "expired").
 */
export const inviteState = ({ invite, now = new Date() }: { invite: InviteStateInput; now?: Date }) => {
  if (invite.status === "accepted") return "accepted";
  if (invite.status === "declined") return "declined";
  if (invite.status === "revoked") return "revoked";
  if (new Date(invite.expiresAt).getTime() <= now.getTime()) return "expired";
  if (invite.maxUses != null && (invite.useCount ?? 0) >= invite.maxUses) return "usedUp";
  return "usable";
};

/** An address an email invite can go to. */
export const inviteEmailZ = z.email().max(254);

/** An address as stored and compared: trimmed and lowercased. */
export const normalizeInviteEmail = (email: string) => email.trim().toLowerCase();

/** Whether `user` is the person an email invite was sent to (case and spaces ignored). */
export const emailMatches = (invite: { email: string | null }, user: { email: string }): boolean =>
  invite.email != null && normalizeInviteEmail(invite.email) === normalizeInviteEmail(user.email);

/** How long a new invite link works unless the inviter picks otherwise, and the range they may pick. */
export const LINK_TTL_DEFAULT_DAYS = 7;
export const LINK_TTL_MIN_DAYS = 1;
export const LINK_TTL_MAX_DAYS = 90;
/** The most uses an inviter may set on one link (no limit is allowed too). */
export const LINK_MAX_USES_LIMIT = 100;

/**
 * A new link's options: a link role, 1–90 days, and an optional maximum
 * number of uses. These are the hard limits; the service applies the app
 * settings' default days and tighter limits (`invites.link*`).
 */
export const linkInviteOptionsZ = z.object({
  role: z.enum(LINK_ROLES),
  expiresInDays: z.int().min(LINK_TTL_MIN_DAYS).max(LINK_TTL_MAX_DAYS).optional(),
  maxUses: z.int().min(1).max(LINK_MAX_USES_LIMIT).nullish(),
});
export type LinkInviteOptions = z.output<typeof linkInviteOptionsZ>;
