import type { Route } from "./+types/route";

import { redirect } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup } from "~/lib/app-shell/group";

// Shared by web + native. `medications/<tab>/allergies`: the old allergies
// sheet. Allergies are managed on the profile now (fixes-ui slice 34), so a
// bookmark or an old link lands there: a writer on the profile's allergies
// sheet, a viewer on the profile.

export function clientLoader({ context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  throw redirect(group.canWrite ? appUrls.profileAllergies(group.id) : appUrls.profile(group.id));
}

export default function OldAllergiesSheet() {
  return null;
}
