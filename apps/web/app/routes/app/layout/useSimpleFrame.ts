import type { GroupContext } from "~/lib/groupContext";
import type { SimpleMembership, SimpleModeState } from "~/lib/useSimpleMode";

import type { GroupRow } from "~/lib/sync/timeline";

import { useMemo } from "react";
import { useRouteLoaderData } from "react-router";
import { appUrls } from "~/lib/appUrls";
import { cachedSettings } from "~/lib/me";
import { useLiveQuery } from "~/lib/sync";
import { myGroupsQuery } from "~/lib/sync/timeline";
import { useLiveMembership, useSimpleMode } from "~/lib/useSimpleMode";

const NO_MEMBERSHIP: SimpleMembership = { role: null, simpleMode: { ownerDefault: false, locked: false } };

/**
 * Whether the /app header is simple mode's reduced one: on a group's
 * timeline (its sheets included) while the timeline shows its simple view,
 * and on every page of a group you're locked into it in (the lock keeps you
 * to the timeline and your notes' and events' pages: `lib/simpleModeLock.ts`).
 * The same inputs as the timeline's (`useSimpleMode`): the membership live
 * from the device (the group route's loader data until the watch answers),
 * your own setting as this device last loaded it, and the device's toggle.
 * Null for the full header.
 */
export function useSimpleFrame(
  userId: string,
  groupId: string | undefined,
  pathname: string,
): SimpleModeState | null {
  const loaded = useRouteLoaderData<GroupContext>("group");
  const membership = useLiveMembership(userId, groupId ?? "", loaded);
  const mode = useSimpleMode(
    userId,
    groupId ?? "",
    membership ?? NO_MEMBERSHIP,
    cachedSettings(userId).simpleMode,
  );
  const onTimeline = !!groupId && pathname.startsWith(appUrls.timeline(groupId));
  return membership && (mode.locked || (onTimeline && mode.simple)) ? mode : null;
}

// One array for every render: `useLiveQuery` treats a new `initial` as new loader data.
const NO_GROUPS: GroupRow[] = [];

/**
 * Whether `userId` has more than one group on this device (live): simple
 * mode's user menu then offers the list of groups, since it has no group menu.
 */
export function useSeveralGroups(userId: string) {
  const query = useMemo(() => myGroupsQuery(userId), [userId]);
  return useLiveQuery<GroupRow>(query.sql, query.params, NO_GROUPS).length > 1;
}
