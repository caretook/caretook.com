import type { SyncDb } from "./index";

import { readRows } from "./timeline";

const POLL_MS = 150;

/**
 * Wait until `userId`'s membership of `groupId` has left this device (the
 * sync that follows leaving a group), for at most `ms`. Resolves to whether
 * it's gone; offline or on a slow sync it gives up and says no.
 */
export const waitForMembershipGone = async (
  db: SyncDb,
  { groupId, userId }: { groupId: string; userId: string },
  ms = 10_000,
): Promise<boolean> => {
  const query = {
    sql: `SELECT 1 AS here FROM care_group_member WHERE group_id = ? AND user_id = ? LIMIT 1`,
    params: [groupId, userId],
  };
  const end = Date.now() + ms;
  for (;;) {
    if ((await readRows<{ here: number }>(db, query)).length === 0) return true;
    if (Date.now() >= end) return false;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
};
