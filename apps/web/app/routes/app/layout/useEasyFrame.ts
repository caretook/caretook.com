import type { GroupContext } from "~/lib/app-shell/groupContext";
import type { EasyMembership, EasyModeState } from "~/lib/assistant/useEasyMode";

import type { GroupRow } from "~/lib/timeline/timeline.sync";

import { useMemo } from "react";
import { useRouteLoaderData } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useCachedSettings } from "~/lib/app-shell/me";
import { useLiveQuery } from "~/lib/sync";
import { myGroupsQuery } from "~/lib/timeline/timeline.sync";
import { useLiveMembership, useEasyMode } from "~/lib/assistant/useEasyMode";

const NO_MEMBERSHIP: EasyMembership = { role: null };

/**
 * Whether the /app header is easy mode's reduced one: on a group's
 * timeline (its sheets included) while the timeline shows its easy view,
 * and on every page of a group where your role is an easy one (it keeps you
 * to the pages in `lib/assistant/easyModeLock.ts`).
 * The same inputs as the timeline's (`useEasyMode`): the membership live
 * from the device (the group route's loader data until the watch answers),
 * your own setting as this device knows it (live from the settings store, as
 * the timeline's `useMySettings` is, so a change from another device that a
 * refresh brings switches both at once), and the device's toggle.
 * Null for the full header.
 */
export function useEasyFrame(
  userId: string,
  groupId: string | undefined,
  pathname: string,
): EasyModeState | null {
  const loaded = useRouteLoaderData<GroupContext>("group");
  const membership = useLiveMembership(userId, groupId ?? "", loaded);
  const { easyMode } = useCachedSettings(userId);
  const mode = useEasyMode(userId, groupId ?? "", membership ?? NO_MEMBERSHIP, easyMode);
  const onTimeline = !!groupId && pathname.startsWith(appUrls.timeline(groupId));
  return membership && (mode.easyRole || (onTimeline && mode.easy)) ? mode : null;
}

// One array for every render: `useLiveQuery` treats a new `initial` as new loader data.
const NO_GROUPS: GroupRow[] = [];

/**
 * Whether `userId` has more than one group on this device (live): easy
 * mode's user menu then offers the list of groups, since it has no group menu.
 */
export function useSeveralGroups(userId: string) {
  const query = useMemo(() => myGroupsQuery(userId), [userId]);
  return useLiveQuery<GroupRow>(query.sql, query.params, NO_GROUPS).length > 1;
}
