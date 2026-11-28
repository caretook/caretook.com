import type { Route } from "./+types/route";

import { redirect } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";

// Shared by web + native. `setup` and `setup/<anything without a page>`: the first step. Each step with a
// page is a static route beside this one, so it never lands here.

export function clientLoader({ params }: Route.ClientLoaderArgs) {
  throw redirect(appUrls.setup(params.groupId));
}

export default function UnknownSetupStep() {
  return null;
}
