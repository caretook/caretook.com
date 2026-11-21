import type { EasyModeSetting } from "@caretook/data/schema";
import type { GroupContext } from "../app-shell/groupContext";
import type { EasyMode } from "./easyMode";
import type { GroupRow } from "../timeline/timeline.sync";

import { useMemo } from "react";
import { resolveEasyMode } from "./easyMode";
import { useDeviceToggle } from "./easyModeToggle";
import { useLiveQuery } from "../sync";
import { myGroupQuery } from "../timeline/timeline.sync";

/** What `resolveEasyMode` needs from the membership. */
export type EasyMembership = Pick<GroupContext, "role" | "easyMode">;

export type EasyModeState = EasyMode & {
  /** Switch this device between easy and full for the group (a no-op while locked). */
  toggle: () => void;
};

/**
 * Whether `userId` sees `groupId`'s timeline in easy mode, live: the
 * managers' default and lock (synced, in `membership`), your own setting,
 * and this device's toggle (shared by every component on the page).
 */
export function useEasyMode(
  userId: string,
  groupId: string,
  membership: EasyMembership,
  ownSetting: EasyModeSetting,
): EasyModeState {
  const [deviceToggle, setDeviceToggle] = useDeviceToggle(userId, groupId);
  const mode = resolveEasyMode({
    role: membership.role,
    ownerDefault: membership.easyMode.ownerDefault,
    locked: membership.easyMode.locked,
    ownSetting,
    deviceToggle,
  });
  return {
    ...mode,
    toggle: () => {
      if (mode.canToggle) setDeviceToggle(mode.easy ? "full" : "easy");
    },
  };
}

// One array for every render: `useLiveQuery` treats a new `initial` as new loader data.
const NO_ROWS: GroupRow[] = [];

/**
 * Your membership's easy-mode fields, live from the device, for screens
 * outside the group route (the /app header). `initial` (the group route's
 * loader data) covers the moment before the watch answers.
 */
export function useLiveMembership(
  userId: string,
  groupId: string,
  initial: EasyMembership | undefined,
): EasyMembership | null {
  const query = useMemo(() => myGroupQuery(userId, groupId), [userId, groupId]);
  const [row] = useLiveQuery<GroupRow>(query.sql, query.params, NO_ROWS);
  return useMemo(
    () =>
      row
        ? {
            role: (row.role ?? null) as GroupContext["role"],
            easyMode: { ownerDefault: !!row.simple_mode, locked: !!row.simple_mode_locked },
          }
        : (initial ?? null),
    [row, initial],
  );
}
