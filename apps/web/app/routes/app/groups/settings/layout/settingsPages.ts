import type { GroupSettingsPage } from "~/lib/care-groups/urls";
import type { SettingsItem } from "~/lib/app-shell/settingsNav";

import { Bandage, Bot, CalendarDays, Info, Tag, Users } from "lucide-react";
import { appUrls } from "~/lib/app-shell/appUrls";

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
  {
    id: "assistants",
    label: "Assistants",
    description: "Whether members may connect their own AI assistant",
    icon: Bot,
    path: appUrls.groupSettings(groupId, "assistants"),
  },
  {
    id: "calendar",
    label: "Calendar & reminders",
    description: "Your reminder emails, calendar feed and what they say",
    icon: CalendarDays,
    path: appUrls.calendarSettings(groupId),
  },
  {
    id: "tags",
    label: "Tags",
    description: "The group's tags: their names, colors and how many items carry each",
    icon: Tag,
    path: appUrls.groupSettings(groupId, "tags"),
  },
  {
    id: "symptoms",
    label: "Symptoms",
    description:
      "The symptoms the group logs: how many entries each has, and archiving ones no longer needed",
    icon: Bandage,
    path: appUrls.groupSettings(groupId, "symptoms"),
  },
];
