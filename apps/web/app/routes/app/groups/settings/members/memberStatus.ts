import { isManagerRole } from "@caretook/data/permissions";
import { ORPCError } from "@orpc/client";
import { rpc } from "~/lib/core/rpc";
import { shortDate } from "./invites";

// Members' account status for owners and admins (B-679): whether each has
// confirmed their email, and when they last signed in. It comes from the API
// (`careGroup.memberStatuses`), never the synced member row, so it shows only
// online; offline, and for other roles, there's none.

export type MemberStatus = { emailVerified: boolean; lastSignInAt: string | null };
export type MemberStatuses = Record<string, MemberStatus>;

/** Each member's status by user id, or none (offline, or not an owner or admin). */
export const loadMemberStatuses = async (
  groupId: string,
  myRole: string | null,
  online: boolean,
): Promise<MemberStatuses> => {
  if (!online || !isManagerRole(myRole)) return {};
  try {
    const rows = await rpc.careGroup.memberStatuses({ groupId });
    return Object.fromEntries(
      rows.map((row) => [row.userId, { emailVerified: row.emailVerified, lastSignInAt: row.lastSignInAt }]),
    );
  } catch (e) {
    // Lost the connection, or the role, since the page started loading: show none.
    if (e instanceof TypeError) return {};
    if (e instanceof ORPCError && (e.status === 403 || e.status === 404)) return {};
    throw e;
  }
};

/** "Email not confirmed" or "Email confirmed", then "Last signed in Nov 22, 2026" while a session remains. */
export const memberStatusLine = (status: MemberStatus, locale?: string) => {
  const email = status.emailVerified ? "Email confirmed" : "Email not confirmed";
  return status.lastSignInAt ? `${email} · Last signed in ${shortDate(status.lastSignInAt, locale)}` : email;
};
