import type { SimpleModeSetting } from "@caretook/data/schema";
import type { GroupContext } from "./groupContext";
import type { SimpleMode } from "./simpleMode";
import type { GroupRow } from "./sync/timeline";

import { useMemo } from "react";
import { resolveSimpleMode } from "./simpleMode";
import { useDeviceToggle } from "./simpleModeToggle";
import { useLiveQuery } from "./sync";
import { myGroupQuery } from "./sync/timeline";

/** What `resolveSimpleMode` needs from the membership. */
export type SimpleMembership = Pick<GroupContext, "role" | "simpleMode">;

export type SimpleModeState = SimpleMode & {
  /** Switch this device between simple and full for the group (a no-op while locked). */
  toggle: () => void;
};

/**
 * Whether `userId` sees `groupId`'s timeline in simple mode, live: the
 * managers' default and lock (synced, in `membership`), your own setting,
 * and this device's toggle (shared by every component on the page).
 */
export function useSimpleMode(
  userId: string,
  groupId: string,
  membership: SimpleMembership,
  ownSetting: SimpleModeSetting,
): SimpleModeState {
  const [deviceToggle, setDeviceToggle] = useDeviceToggle(userId, groupId);
  const mode = resolveSimpleMode({
    role: membership.role,
    ownerDefault: membership.simpleMode.ownerDefault,
    locked: membership.simpleMode.locked,
    ownSetting,
    deviceToggle,
  });
  return {
    ...mode,
    toggle: () => {
      if (mode.canToggle) setDeviceToggle(mode.simple ? "full" : "simple");
    },
  };
}

// One array for every render: `useLiveQuery` treats a new `initial` as new loader data.
const NO_ROWS: GroupRow[] = [];

/**
 * Your membership's simple-mode fields, live from the device, for screens
 * outside the group route (the /app header). `initial` (the group route's
 * loader data) covers the moment before the watch answers.
 */
export function useLiveMembership(
  userId: string,
  groupId: string,
  initial: SimpleMembership | undefined,
): SimpleMembership | null {
  const query = useMemo(() => myGroupQuery(userId, groupId), [userId, groupId]);
  const [row] = useLiveQuery<GroupRow>(query.sql, query.params, NO_ROWS);
  return useMemo(
    () =>
      row
        ? {
            role: (row.role ?? null) as GroupContext["role"],
            simpleMode: { ownerDefault: !!row.simple_mode, locked: !!row.simple_mode_locked },
          }
        : (initial ?? null),
    [row, initial],
  );
}
