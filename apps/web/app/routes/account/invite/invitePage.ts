import { emailMatches } from "@caretook/data/schema";

// The pure parts of `/invite/:token`: which view to show, and what the
// states say. An unusable invite never names the group or the person it's
// for, so a forwarded or old link leaks nothing.

export type InvitePreview =
  | { state: "notFound" | "expired" | "revoked" | "usedUp" | "accepted" | "declined" }
  | {
      state: "usable";
      kind: "email" | "link";
      role: string;
      email: string | null;
      groupName: string | null;
      inviterName: string | null;
      expiresAt: string;
    };

export type UsablePreview = Extract<InvitePreview, { state: "usable" }>;

export type InviteView =
  | { view: "closed"; title: string; message: string }
  | { view: "signUp" | "consent"; invite: UsablePreview }
  | { view: "wrongAccount"; invite: UsablePreview; signedInAs: string };

const CLOSED: Record<Exclude<InvitePreview["state"], "usable">, { title: string; message: string }> = {
  notFound: {
    title: "This invitation isn't valid",
    message:
      "The link may be incomplete, or a newer invitation replaced it. Ask the person who invited you to send it again.",
  },
  expired: {
    title: "This invitation has expired",
    message: "Invitations work for 7 days. Ask the person who invited you to send a new one.",
  },
  revoked: {
    title: "This invitation was withdrawn",
    message: "The person who sent it withdrew it. Ask them if you think that's a mistake.",
  },
  usedUp: {
    title: "This invitation has been used up",
    message: "Ask the person who invited you for a new one.",
  },
  accepted: {
    title: "This invitation was already accepted",
    message: "If it was you, sign in to see the care group.",
  },
  declined: {
    title: "This invitation was declined",
    message: "Ask the person who invited you to send a new one if you change your mind.",
  },
};

/** What the page shows for this invite and whoever is signed in (null: nobody). */
export const inviteView = (preview: InvitePreview, user: { email: string } | null): InviteView => {
  if (preview.state !== "usable") return { view: "closed", ...CLOSED[preview.state] };
  if (!user) return { view: "signUp", invite: preview };
  if (preview.kind === "email" && !emailMatches(preview, user))
    return { view: "wrongAccount", invite: preview, signedInAs: user.email };
  return { view: "consent", invite: preview };
};

const ROLE_ARTICLES: Record<string, string> = {
  owner: "an owner",
  admin: "an admin",
  caretaker: "a caretaker",
  viewer: "a viewer",
};

/** "a caretaker"; a role this build doesn't know shows as it is. */
export const roleWithArticle = (role: string) => ROLE_ARTICLES[role] ?? role;

/** What a role lets the new member do, in a line. */
export const roleMeaning = (role: string) =>
  role === "viewer"
    ? "You'll be able to read everything the group shares, but not add to it."
    : role === "caretaker"
      ? "You'll be able to read and add to everything the group shares."
      : "You'll be able to read and add to everything the group shares, and manage its members.";

/** The page's heading for a usable invite. */
export const inviteTitle = (invite: UsablePreview) =>
  invite.groupName ? `Join ${invite.groupName}'s care group` : "Join a care group";

/** "Avery invited you as a caretaker." */
export const invitedLine = (invite: UsablePreview) =>
  `${invite.inviterName?.trim() || "Someone"} invited you to join as ${roleWithArticle(invite.role)}.`;

/** Whether this invite is a shared link: anyone may use it, and joining waits for approval. */
export const isLink = (invite: UsablePreview) => invite.kind === "link";

/** The consent form's button: an email invite joins, a link asks. */
export const joinLabel = (invite: UsablePreview, busy: boolean) =>
  isLink(invite) ? (busy ? "Asking…" : "Ask to join") : busy ? "Joining…" : "Join the care group";

/** What a link's page says about approval, before asking. */
export const LINK_APPROVAL_NOTE =
  "An owner or admin of the group approves each request. Until then you won't see anything in it.";
