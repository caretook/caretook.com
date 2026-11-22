import type { LinkRole } from "@caretook/data/schema";
import type { ActionResult } from "~/lib/core/api";

import {
  invitableRoles,
  LINK_MAX_USES_LIMIT,
  LINK_ROLES,
  LINK_TTL_DEFAULT_DAYS,
  LINK_TTL_MAX_DAYS,
  LINK_TTL_MIN_DAYS,
} from "@caretook/data/schema";

// The pure parts of invite links and join requests on the Members page: who
// may make links, what a link's line says, checking the link form, and
// sharing a link (the share sheet, else the clipboard). The server stays the
// authority. Unit-tested in web:unit.

/** A link as `invite.listLinks` returns it (the fields the page uses). */
export type LinkRow = {
  id: string;
  role: string;
  state: string;
  expiresAt: string;
  createdAt: string;
  maxUses: number | null;
  useCount: number;
  sentBy: { userId: string; name: string | null } | null;
};

/** A waiting request as `joinRequest.list` returns it. */
export type JoinRequestRow = {
  id: string;
  role: string;
  createdAt: string;
  name: string | null;
  email: string | null;
};

/** The roles a member may put on a link (`LINK_ROLES`), for owners and admins only. */
export const linkRoles = (myRole: string | null) => invitableRoles(myRole, "link");

export { LINK_MAX_USES_LIMIT, LINK_TTL_DEFAULT_DAYS, LINK_TTL_MAX_DAYS, LINK_TTL_MIN_DAYS };

/** What `invite.options` says the invite controls may offer (admin settings). */
export type InviteOptions = {
  emailInvites: boolean;
  linkInvites: boolean;
  link: { defaultDays: number; maxDays: number; maxUses: number };
};

/** The options before the server has said (offline, or not a manager): the built-in limits. */
export const DEFAULT_INVITE_OPTIONS: InviteOptions = {
  emailInvites: true,
  linkInvites: true,
  link: { defaultDays: LINK_TTL_DEFAULT_DAYS, maxDays: LINK_TTL_MAX_DAYS, maxUses: LINK_MAX_USES_LIMIT },
};

/** What a switched-off invite control says. */
export const INVITES_UNAVAILABLE = {
  email: "Email invites aren't available right now.",
  link: "Invite links aren't available right now.",
} as const;

const shortDate = (iso: string, locale?: string) =>
  new Date(iso).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });

/** "Used 1 of 10 times", "Used 3 times", "Not used yet". */
export const linkUses = (link: Pick<LinkRow, "maxUses" | "useCount">) => {
  if (link.maxUses != null)
    return `Used ${link.useCount} of ${link.maxUses} ${link.maxUses === 1 ? "time" : "times"}`;
  if (link.useCount === 0) return "Not used yet";
  return `Used ${link.useCount} ${link.useCount === 1 ? "time" : "times"}`;
};

/** "Used 1 of 10 times · Expires Nov 25, 2026", or why it no longer works. */
export const linkStatusLine = (link: LinkRow, locale?: string) => {
  const when =
    link.state === "expired"
      ? `Expired ${shortDate(link.expiresAt, locale)}`
      : link.state === "usedUp"
        ? "Used up"
        : `Expires ${shortDate(link.expiresAt, locale)}`;
  return [linkUses(link), when].join(" · ");
};

/** Only a link that still works can be copied or shared. */
export const linkActive = (link: Pick<LinkRow, "state">) => link.state === "usable";

/** "Asked Nov 18, 2026". */
export const requestedLine = (request: Pick<JoinRequestRow, "createdAt">, locale?: string) =>
  `Asked ${shortDate(request.createdAt, locale)}`;

/** A requester's name for buttons and dialogs: the name they gave, else their address. */
export const requesterName = (request: Pick<JoinRequestRow, "name" | "email">) =>
  request.name?.trim() || request.email || "This person";

type Failure = Extract<ActionResult, { ok: false }>;

export type LinkForm = {
  role: LinkRole;
  expiresInDays: number;
  maxUses: number | null;
};

const wholeNumber = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN);

/**
 * A submitted link: a role the member may offer (`LINK_ROLES`), a
 * number of days within `limits` (empty: the default), and a maximum number
 * of uses (empty: no limit). `limits` are the admin settings' when the page
 * has them; the server checks them again either way.
 */
export const parseLinkForm = (
  values: { role: string; expiresInDays: string; maxUses: string },
  myRole: string | null,
  limits: InviteOptions["link"] = DEFAULT_INVITE_OPTIONS.link,
): { ok: true; data: LinkForm } | Failure => {
  const issues: Failure["issues"] = [];
  const role = LINK_ROLES.find((r) => r === values.role && linkRoles(myRole).includes(r));
  if (!role) issues.push({ path: "role", message: "Choose a role." });
  const days = values.expiresInDays.trim() ? wholeNumber(values.expiresInDays) : limits.defaultDays;
  if (!(days >= LINK_TTL_MIN_DAYS && days <= limits.maxDays))
    issues.push({
      path: "expiresInDays",
      message: `Choose ${LINK_TTL_MIN_DAYS} to ${limits.maxDays} days.`,
    });
  const maxUses = values.maxUses.trim() ? wholeNumber(values.maxUses) : null;
  if (maxUses !== null && !(maxUses >= 1 && maxUses <= limits.maxUses))
    issues.push({
      path: "maxUses",
      message: `Leave it empty for no limit, or choose 1 to ${limits.maxUses}.`,
    });
  if (issues.length || !role) return { ok: false, error: "Check the link's settings.", issues };
  return { ok: true, data: { role, expiresInDays: days, maxUses } };
};

/** The web URL of an invite link. Native apps use the web origin (`VITE_API_ORIGIN`), not `capacitor://`. */
export const inviteLinkUrl = (origin: string, path: string) => new URL(path, origin).href;

/** The parts of `navigator` that sharing uses (a fake in tests). */
export type ShareNavigator = {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  canShare?: (data: { title?: string; text?: string; url?: string }) => boolean;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

/**
 * - `shared`: the share sheet took it.
 * - `cancelled`: the share sheet was dismissed (say nothing).
 * - `copied`: copied to the clipboard.
 * - `failed`: neither worked; show the link so it can be copied by hand.
 */
export type ShareOutcome = "shared" | "cancelled" | "copied" | "failed";

/** Copy a link to the clipboard. */
export async function copyLinkText(nav: ShareNavigator, url: string): Promise<ShareOutcome> {
  try {
    if (!nav.clipboard) return "failed";
    await nav.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

/** The share sheet where there is one, otherwise the clipboard. */
export async function shareLinkText(
  nav: ShareNavigator,
  data: { title: string; text: string; url: string },
): Promise<ShareOutcome> {
  if (nav.share && (nav.canShare?.(data) ?? true)) {
    try {
      await nav.share(data);
      return "shared";
    } catch (e) {
      // Dismissing the sheet is an AbortError; anything else falls back to the clipboard.
      if (e instanceof Error && e.name === "AbortError") return "cancelled";
    }
  }
  return copyLinkText(nav, data.url);
}

/**
 * What a refused request answer says. The services' own messages are
 * written for people, so they're shown as they are.
 */
export const requestRefusal = (e: unknown): string | null => {
  const code = (e as { data?: { code?: unknown } } | null)?.data?.code;
  if (typeof code !== "string" || !code.startsWith("joinRequestService:")) return null;
  if (code === "joinRequestService:notFound") return "That request is no longer waiting.";
  return (e as { message?: string }).message || null;
};
