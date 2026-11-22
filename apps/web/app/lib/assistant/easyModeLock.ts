import { appUrls } from "../app-shell/appUrls";

// Where a member with an easy role (Easy helper, Easy viewer) may go inside
// their group: the timeline (easy mode's view, and the sheets over it), their
// notes' and events' pages (`entries/…`, new ones too), the Planner's list
// (read-only: not its Past or Todos tabs), a todo's page (not the list or its
// sheets) and search. Every other group route (settings, providers,
// medications, the profile, care periods) sends them to the timeline.
// Account settings and `/app`'s list of groups are outside the group, so they
// stay reachable. Pure, so web:unit tests it; the group route applies it.

const within = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** The path itself, or it with a trailing slash. */
const exactly = (pathname: string, path: string) => pathname === path || pathname === `${path}/`;

/** `…/todos/<id>`: one todo's page (not the list, `todos/new` or a todo's edit sheet). */
const isTodoPage = (pathname: string, groupId: string) => {
  const todos = `${appUrls.groupHome(groupId)}/todos/`;
  if (!pathname.startsWith(todos)) return false;
  const rest = pathname.slice(todos.length).replace(/\/$/, "");
  return rest !== "" && rest !== "new" && !rest.includes("/");
};

/** True when a member with an easy role may stay on `pathname` in `groupId`. */
export const easyRoleAllows = (groupId: string, pathname: string) =>
  within(pathname, appUrls.timeline(groupId)) ||
  within(pathname, `${appUrls.groupHome(groupId)}/entries`) ||
  exactly(pathname, appUrls.planner(groupId)) ||
  exactly(pathname, appUrls.search(groupId)) ||
  isTodoPage(pathname, groupId);

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
