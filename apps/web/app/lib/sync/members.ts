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

/**
 * Wait until `userId`'s membership of `groupId` has reached this device (the
 * sync after accepting an invite), for at most `ms`. Resolves to whether it
 * arrived; on a slow sync it gives up and says no.
 */
export const waitForMembership = async (
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
    if ((await readRows<{ here: number }>(db, query)).length > 0) return true;
    if (Date.now() >= end) return false;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
};

/** A member with who invited them and when they joined (the Members page). */
export type MemberDetailRow = {
  user_id: string;
  role: string | null;
  name: string | null;
  image: string | null;
  /** When the membership was made; null until the row's new columns have synced. */
  created_at: string | null;
  invited_by: string | null;
  /** The inviter's name, while they're still a co-member (their profile syncs only then). */
  invited_by_name: string | null;
  /** How they're related to the recipient, and what they share (`shared_fields`, JSON text). */
  relationship: string | null;
  shared_fields: string | null;
  /** What they share with the group (`member_contact_share`; `phones` is JSON text); null when nothing. */
  share_phones: string | null;
  share_email: string | null;
  share_address: string | null;
};

export const memberDetailsQuery = (groupId: string) => ({
  sql: `SELECT m.user_id, m.role, u.name, u.image, m.created_at, m.invited_by, i.name AS invited_by_name,
          m.relationship, m.shared_fields,
          s.phones AS share_phones, s.email AS share_email, s.address AS share_address
        FROM care_group_member m
        LEFT JOIN "user" u ON u.id = m.user_id
        LEFT JOIN "user" i ON i.id = m.invited_by
        LEFT JOIN member_contact_share s ON s.group_id = m.group_id AND s.user_id = m.user_id
        WHERE m.group_id = ?`,
  params: [groupId],
});
