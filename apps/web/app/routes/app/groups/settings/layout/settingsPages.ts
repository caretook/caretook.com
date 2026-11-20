import type { GroupSettingsPage } from "~/lib/appUrls";
import type { SettingsItem } from "~/lib/settingsNav";

import { Info, Users } from "lucide-react";
import { appUrls } from "~/lib/appUrls";

/**
 * A group's settings subpages, in list order: the first is what a wide
 * screen opens on `…/settings`. A new subpage is one entry here (at the
 * end), its name in `GROUP_SETTINGS_PAGES` (`appUrls`) and its route in
 * `routes.ts`.
 */
export const groupSettingsPages = (groupId: string): (SettingsItem & { id: GroupSettingsPage })[] => [
  {
    id: "details",
    label: "Details",
    description: "The care group's name and the recipient's time zone",
    icon: Info,
    path: appUrls.groupSettings(groupId, "details"),
  },
  {
    id: "members",
    label: "Members",
    description: "Who's in the care group, and their roles",
    icon: Users,
    path: appUrls.groupSettings(groupId, "members"),
  },
];
