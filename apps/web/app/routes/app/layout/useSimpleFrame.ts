import type { GroupContext } from "~/lib/groupContext";
import type { SimpleMembership, SimpleModeState } from "~/lib/useSimpleMode";

import { useRouteLoaderData } from "react-router";
import { appUrls } from "~/lib/appUrls";
import { cachedSettings } from "~/lib/me";
import { useLiveMembership, useSimpleMode } from "~/lib/useSimpleMode";

const NO_MEMBERSHIP: SimpleMembership = { role: null, simpleMode: { ownerDefault: false, locked: false } };

/**
 * Whether the /app header is simple mode's reduced one: on a group's
 * timeline (its sheets included) while the timeline shows its simple view.
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
  return onTimeline && membership && mode.simple ? mode : null;
}
