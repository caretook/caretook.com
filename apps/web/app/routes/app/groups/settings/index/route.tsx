import type { Route } from "./+types/route";

import { redirect } from "react-router";
import { isWideSettings } from "~/components/settings";
import { appUrls } from "~/lib/appUrls";
import { getGroup } from "~/lib/group";
import { groupSettingsPages } from "../layout/settingsPages";

// `…/settings` itself: the list on phones (the layout renders it). Wide
// screens show the side nav beside a subpage instead, so they open the first.

export const meta = () => [{ title: "Group settings · Caretook" }];

export function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  if (isWideSettings()) {
    const [first] = groupSettingsPages(params.groupId);
    throw redirect(first?.path ?? appUrls.groupSettings(params.groupId, "details"));
  }
  return null;
}

// The layout renders the list (and follows a window that widens later).
export default function GroupSettingsIndex() {
  return null;
}
