import type { Route } from "./+types/route";

import { useEffect } from "react";
import { Outlet, redirect, useLocation, useNavigate } from "react-router";
import { getGroup, GroupProvider, setGroup, useGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { lockedRedirect } from "~/lib/assistant/simpleModeLock";

// Shared by web + native. `/app/groups/:groupId`: every screen about one
// care group (the timeline, an entry, group settings, later sections) is a
// child of this route.
//
// Its middleware loads the group once per navigation, before any child
// loader runs, and puts it in the router context. Children's loaders read it
// with `getGroup(context)`, and their components with `useGroup()` (live). A
// group that isn't on the device is `notOnDevice` (the /app error boundary's
// 404, or "Getting your care groups…" on a new device), thrown by
// `getGroup` from the loaders (see lib/app-shell/group.tsx for why not the middleware).
//
// A member locked in simple mode is sent to the timeline from every other
// group route but their notes' and events' pages (`lib/assistant/simpleModeLock.ts`):
// by the middleware on each navigation, and by `LockedRedirect` when a lock
// arrives by sync while they're on one.

export const clientMiddleware: Route.ClientMiddlewareFunction[] = [
  async ({ request, params, context }) => {
    const { db } = context.get(sessionContext);
    await setGroup(context, db, params.groupId);
    let locked = false;
    try {
      locked = getGroup(context).simpleMode.locked;
    } catch {
      // No group: the loaders throw its error.
    }
    const to = lockedRedirect({ groupId: params.groupId, pathname: new URL(request.url).pathname, locked });
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
      <LockedRedirect />
      <Outlet />
    </GroupProvider>
  );
}

/** A lock that arrives (by sync) while you're on a page it closes: go to the timeline. */
function LockedRedirect() {
  const { id, simpleMode } = useGroup();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const to = lockedRedirect({ groupId: id, pathname, locked: simpleMode.locked });
  useEffect(() => {
    if (to) void navigate(to, { replace: true });
  }, [to, navigate]);
  return null;
}
