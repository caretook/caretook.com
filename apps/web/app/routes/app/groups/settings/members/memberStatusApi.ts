import type { MemberStatuses } from "./memberStatus";

import { isManagerRole } from "@caretook/data/permissions";
import { ORPCError } from "@orpc/client";
import { rpc } from "~/lib/core/rpc";

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
