import type { Route } from "./+types/route";

import { redirect } from "react-router";
import { appUrls } from "~/lib/appUrls";
import { getGroup } from "~/lib/group";

// `/app/groups/:groupId` on its own opens the group's timeline (a group that
// isn't on the device is the group route's 404 instead).

export function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  throw redirect(appUrls.timeline(params.groupId));
}

export default function GroupHome() {
  return null;
}
