import type { Route } from "./+types/route";

import { Outlet } from "react-router";
import { getGroup, GroupProvider, setGroup } from "~/lib/group";
import { sessionContext } from "~/lib/session";

// Shared by web + native. `/app/groups/:groupId`: every screen about one
// care group (the timeline, an entry, group settings, later sections) is a
// child of this route.
//
// Its middleware loads the group once per navigation, before any child
// loader runs, and puts it in the router context. Children's loaders read it
// with `getGroup(context)`, and their components with `useGroup()` (live). A
// group that isn't on the device is `notOnDevice` (the /app error boundary's
// 404, or "Getting your care groups…" on a new device), thrown by
// `getGroup` from the loaders (see lib/group.tsx for why not the middleware).

export const clientMiddleware: Route.ClientMiddlewareFunction[] = [
  async ({ params, context }) => {
    const { db } = context.get(sessionContext);
    await setGroup(context, db, params.groupId);
  },
];

export function clientLoader({ context }: Route.ClientLoaderArgs) {
  return getGroup(context);
}

export default function GroupLayout({ loaderData }: Route.ComponentProps) {
  // Keyed on the group: another group is another page, with its own watch.
  return (
    <GroupProvider key={loaderData.id} group={loaderData}>
      <Outlet />
    </GroupProvider>
  );
}
