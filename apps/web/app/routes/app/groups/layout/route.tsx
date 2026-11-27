import type { Route } from "./+types/route";

import { useEffect } from "react";
import { Outlet, redirect, useLocation, useNavigate } from "react-router";
import { getGroup, GroupProvider, setGroup, useGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { MemberLooksProvider } from "~/lib/care-groups/useMemberLooks";
import { easyRoleRedirect } from "~/lib/assistant/easyModeLock";

// Shared by web + native. `/app/groups/:groupId`: every screen about one
// care group (the timeline, an entry, group settings, later sections) is a
// child of this route.
//
// Its middleware loads the group once per navigation, before any child
// loader runs, and puts it in the router context. Children's loaders read it
// with `getGroup(context)`, and their components with `useGroup()` (live). A
// group that isn't on the device is `notOnDevice` (the /app error boundary's
// 404, or "Syncing your care groups…" on a new device), thrown by
// `getGroup` from the loaders (see lib/app-shell/group.tsx for why not the middleware).
//
// A member with an easy role (Easy helper, Easy viewer) is sent to the
// timeline from every other group route but their notes' and events' pages
// (`lib/assistant/easyModeLock.ts`): by the middleware on each navigation, and
// by `EasyRoleRedirect` when the role arrives by sync while they're on one.

export const clientMiddleware: Route.ClientMiddlewareFunction[] = [
  async ({ request, params, context }) => {
    const { db } = context.get(sessionContext);
    await setGroup(context, db, params.groupId);
    let easyRole = false;
    try {
      easyRole = getGroup(context).easyRole;
    } catch {
      // No group: the loaders throw its error.
    }
    const to = easyRoleRedirect({
      groupId: params.groupId,
      pathname: new URL(request.url).pathname,
      easyRole,
    });
    if (to) throw redirect(to);
  },
];

export function clientLoader({ context }: Route.ClientLoaderArgs) {
  return getGroup(context);
}

export default function GroupLayout({ loaderData }: Route.ComponentProps) {
  // Keyed on the group: another group is another page, with its own watch.
  return (
    <GroupProvider key={loaderData.id} group={loaderData}>
      <MemberLooksProvider>
        <EasyRoleRedirect />
        <Outlet />
      </MemberLooksProvider>
    </GroupProvider>
  );
}

/** An easy role that arrives (by sync) while you're on a page it closes: go to the timeline. */
function EasyRoleRedirect() {
  const { id, easyRole } = useGroup();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const to = easyRoleRedirect({ groupId: id, pathname, easyRole });
  useEffect(() => {
    if (to) void navigate(to, { replace: true });
  }, [to, navigate]);
  return null;
}
