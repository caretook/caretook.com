import { appUrls } from "../app-shell/appUrls";

// Where a member locked in easy mode may go inside their group (assistant
// PRD): the timeline (easy mode's view, and the sheets over it) and their
// notes' and events' pages (`entries/…`, new ones too). Every other group
// route (settings, providers, medications, Upcoming, search, the profile,
// care periods) sends them to the timeline. Account settings and `/app`'s
// list of groups are outside the group, so they stay reachable. Pure, so
// web:unit tests it; the group route applies it.

const within = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** True when a locked member may stay on `pathname` in `groupId`. */
export const lockAllows = (groupId: string, pathname: string) =>
  within(pathname, appUrls.timeline(groupId)) || within(pathname, `${appUrls.groupHome(groupId)}/entries`);

/**
 * Where a member goes instead of `pathname`: the group's timeline when
 * they're locked in easy mode and the page isn't one they may use; null to stay.
 */
export const lockedRedirect = ({
  groupId,
  pathname,
  locked,
}: {
  groupId: string;
  pathname: string;
  locked: boolean;
}): string | null => (locked && !lockAllows(groupId, pathname) ? appUrls.timeline(groupId) : null);
