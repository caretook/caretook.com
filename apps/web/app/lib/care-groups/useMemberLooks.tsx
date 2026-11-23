import type { ReactNode } from "react";
import type { LookMember, MemberLook } from "./memberLooks";

import { readAvatarChoice } from "@caretook/data/schema";
import { createContext, useContext, useMemo } from "react";
import { useGroup } from "../app-shell/group";
import { useMyAvatarOverlay } from "../app-shell/myAvatar";
import { useLiveQuery } from "../sync/index";
import { resolveMemberLooks } from "./memberLooks";

// The group's looks on this device, live, for the member-aware avatar: call
// sites pass a user id and never thread colors through props. Your own row
// shows your pending or just-sent choice until the synced row matches it.

type LookRow = {
  id: string;
  user_id: string;
  created_at: string | null;
  avatar_color: string | null;
  avatar_icon: string | null;
};

export const memberLooksQuery = (groupId: string) => ({
  sql: `SELECT m.id, m.user_id, m.created_at, u.avatar_color, u.avatar_icon
        FROM care_group_member m LEFT JOIN "user" u ON u.id = m.user_id
        WHERE m.group_id = ?`,
  params: [groupId],
});

const NO_ROWS: LookRow[] = [];

/** Someone with no membership here (a former member, an unknown author): initials on neutral. */
export const NEUTRAL_LOOK = { neutral: true } as const;

const Looks = createContext<ReadonlyMap<string, MemberLook> | null>(null);

/** Serves the current group's looks to the screens below it. */
export function MemberLooksProvider({ children }: { children: ReactNode }) {
  const { id: groupId, userId } = useGroup();
  const query = memberLooksQuery(groupId);
  const rows = useLiveQuery<LookRow>(query.sql, query.params, NO_ROWS);
  const mine = rows.find((row) => row.user_id === userId);
  const myColor = mine?.avatar_color;
  const myIcon = mine?.avatar_icon;
  const onDevice = !!mine;
  const synced = useMemo(
    () => (onDevice ? readAvatarChoice({ color: myColor, icon: myIcon }) : null),
    [onDevice, myColor, myIcon],
  );
  const overlay = useMyAvatarOverlay(userId, synced);
  const looks = useMemo(() => {
    const members = rows.map((row): LookMember => ({
      userId: row.user_id,
      membershipId: row.id,
      joinedAt: row.created_at,
      color: row.user_id === userId && overlay ? overlay.color : row.avatar_color,
      icon: row.user_id === userId && overlay ? overlay.icon : row.avatar_icon,
    }));
    return resolveMemberLooks(members);
  }, [rows, userId, overlay]);
  return <Looks.Provider value={looks}>{children}</Looks.Provider>;
}

/** A user's look in the current group; neutral when they aren't a member. */
export const useMemberLook = (userId: string | null | undefined) => {
  const looks = useContext(Looks);
  return (userId ? looks?.get(userId) : undefined) ?? NEUTRAL_LOOK;
};

/** Every look in the current group, for a stack of avatars. */
export const useMemberLookOf = () => {
  const looks = useContext(Looks);
  return (userId: string) => looks?.get(userId) ?? NEUTRAL_LOOK;
};
