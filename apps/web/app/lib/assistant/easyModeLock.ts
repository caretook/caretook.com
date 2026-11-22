import { appUrls } from "../app-shell/appUrls";

// Where a member with an easy role (Easy helper, Easy viewer) may go inside
// their group: the timeline (easy mode's view, and the sheets over it) and
// their notes' and events' pages (`entries/…`, new ones too). Every other
// group route (settings, providers, medications, the Planner, search, the
// profile, care periods) sends them to the timeline. Account settings and
// `/app`'s list of groups are outside the group, so they stay reachable.
// Pure, so web:unit tests it; the group route applies it.

const within = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** True when a member with an easy role may stay on `pathname` in `groupId`. */
export const easyRoleAllows = (groupId: string, pathname: string) =>
  within(pathname, appUrls.timeline(groupId)) || within(pathname, `${appUrls.groupHome(groupId)}/entries`);

/**
 * Where a member goes instead of `pathname`: the group's timeline when their
 * role is an easy one and the page isn't one they may use; null to stay.
 */
export const easyRoleRedirect = ({
  groupId,
  pathname,
  easyRole,
}: {
  groupId: string;
  pathname: string;
  easyRole: boolean;
}): string | null => (easyRole && !easyRoleAllows(groupId, pathname) ? appUrls.timeline(groupId) : null);
