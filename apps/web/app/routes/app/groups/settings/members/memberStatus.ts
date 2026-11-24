import { shortDate } from "./invites";

// Members' account status for owners and admins (B-679): whether each has
// confirmed their email, and when they last signed in. It comes from the API
// (`careGroup.memberStatuses`), never the synced member row, so it shows only
// online; offline, and for other roles, there's none. The read is memberStatusApi.ts.

export type MemberStatus = { emailVerified: boolean; lastSignInAt: string | null };
export type MemberStatuses = Record<string, MemberStatus>;

/** "Email not confirmed" or "Email confirmed", then "Last signed in Nov 22, 2026" while a session remains. */
export const memberStatusLine = (status: MemberStatus, locale?: string) => {
  const email = status.emailVerified ? "Email confirmed" : "Email not confirmed";
  return status.lastSignInAt ? `${email} · Last signed in ${shortDate(status.lastSignInAt, locale)}` : email;
};
