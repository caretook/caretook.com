import type { ActionResult } from "~/lib/core/api";

import { isManagerRole } from "@caretook/data/permissions";
import { invitableRoles, inviteEmailZ } from "@caretook/data/schema";

// The pure parts of inviting from the Members page: who may invite, what an
// invite's line says, a member's history line, and checking the invite form.
// The server stays the authority. Unit-tested in web:unit.

/** An invite as `invite.listForGroup` returns it (the fields the page uses). */
export type InviteRow = {
  id: string;
  email: string | null;
  role: string;
  status: string;
  state: string;
  expiresAt: string;
  respondedAt: string | null;
  sentBy: { userId: string; name: string | null } | null;
};

/** The roles a member may invite by email (none: no Invite button). */
export const emailInviteRoles = (myRole: string | null) => invitableRoles(myRole, "email");

/** Whether the member may send this invite again (only owners resend owner invites). */
export const mayResend = (myRole: string | null, invite: { role: string; status: string }) =>
  invite.status === "pending" && emailInviteRoles(myRole).some((role) => role === invite.role);

/** Managers withdraw any waiting invite. */
export const mayRevoke = (myRole: string | null, invite: { status: string }) =>
  invite.status === "pending" && isManagerRole(myRole);

export const shortDate = (iso: string, locale?: string) =>
  new Date(iso).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });

/** "Sent by Sam · Expires Nov 25, 2026", "Expired Nov 17, 2026 · …" or "Declined Nov 18, 2026". */
export const inviteStatusLine = (invite: InviteRow, locale?: string) => {
  const sentBy = invite.sentBy?.name ? `Sent by ${invite.sentBy.name}` : null;
  const when =
    invite.status === "declined"
      ? `Declined ${shortDate(invite.respondedAt ?? invite.expiresAt, locale)}`
      : invite.state === "expired"
        ? `Expired ${shortDate(invite.expiresAt, locale)}`
        : `Expires ${shortDate(invite.expiresAt, locale)}`;
  return invite.status === "declined"
    ? [when, sentBy].filter(Boolean).join(" · ")
    : [sentBy, when].filter(Boolean).join(" · ");
};

/** "Invited by Sam · Joined Nov 18, 2026", or just when they joined; null before that has synced. */
export const memberHistory = (
  member: { created_at: string | null; invited_by_name: string | null },
  locale?: string,
) => {
  if (!member.created_at) return null;
  const joined = `Joined ${shortDate(member.created_at, locale)}`;
  const inviter = member.invited_by_name?.trim();
  return inviter ? `Invited by ${inviter} · ${joined}` : joined;
};

type Failure = Extract<ActionResult, { ok: false }>;

/**
 * A submitted invite: a valid address, a role the member may offer, and the
 * attestation ticked. Otherwise the fields' errors.
 */
export const parseInviteForm = (
  values: { email: string; role: string; attested: string },
  myRole: string | null,
): { ok: true; data: { email: string; role: ReturnType<typeof emailInviteRoles>[number] } } | Failure => {
  const issues: Failure["issues"] = [];
  const email = values.email.trim();
  if (!inviteEmailZ.safeParse(email).success)
    issues.push({ path: "email", message: "Enter an email address." });
  const role = emailInviteRoles(myRole).find((allowed) => allowed === values.role);
  if (!role) issues.push({ path: "role", message: "Choose a role." });
  if (values.attested !== "on")
    issues.push({ path: "attested", message: "Confirm this before sending the invitation." });
  if (issues.length || !role) return { ok: false, error: "Check the invitation.", issues };
  return { ok: true, data: { email, role } };
};

/**
 * What a refused invite change says. The invite rules' own messages are
 * written for people, so they're shown as they are.
 */
export const inviteRefusal = (e: unknown): string | null => {
  const code = (e as { data?: { code?: unknown } } | null)?.data?.code;
  // Switched off in the admin settings: a plain "not available right now".
  if (code === "settings:signupClosed") return (e as { message?: string }).message || null;
  if (typeof code !== "string" || !code.startsWith("careGroupInviteService:")) return null;
  if (code === "careGroupInviteService:notFound") return "That invitation is no longer waiting.";
  // Over the settings' link limits: the issue goes on its field.
  if (code === "careGroupInviteService:linkTooLong" || code === "careGroupInviteService:tooManyUses")
    return null;
  return (e as { message?: string }).message || null;
};
