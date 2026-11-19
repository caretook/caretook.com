import type { MemberRow } from "./timeline";

import { useCallback } from "react";
import { useLiveQuery } from "./index";
import { membersQuery } from "./timeline";

const NO_MEMBERS: MemberRow[] = [];

/**
 * The group's members' names, live: "you" for `meId`, "Former member" for
 * someone no longer in the group (Today's "Ann logged 2 of 3").
 */
export function useMemberNames(groupId: string, meId: string) {
  const q = membersQuery(groupId);
  const rows = useLiveQuery<MemberRow>(q.sql, q.params, NO_MEMBERS);
  return useCallback(
    (userId: string) =>
      userId === meId ? "you" : (rows.find((r) => r.user_id === userId)?.name ?? "Former member"),
    [rows, meId],
  );
}
