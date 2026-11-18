import type { SettingsItem } from "~/lib/settingsNav";
import type { AccountSettingsPage } from "~/lib/appUrls";

import { LayoutList, Ruler, UserRound } from "lucide-react";
import { appUrls } from "~/lib/appUrls";

/**
 * The account's settings subpages, in list order: the first is what a wide
 * screen opens on `/app/settings`. A new subpage is one entry here (at the
 * end), its name in `ACCOUNT_SETTINGS_PAGES` (`appUrls`) and its route in
 * `routes.ts`.
 */
export const ACCOUNT_SETTINGS: readonly (SettingsItem & { id: AccountSettingsPage })[] = [
  {
    id: "units",
    label: "Units",
    description: "How temperature, weight, blood sugar and fluids show",
    icon: Ruler,
    path: appUrls.settings("units"),
  },
  {
    id: "timeline",
    label: "Timeline layout",
    description: "Rows or cards",
    icon: LayoutList,
    path: appUrls.settings("timeline"),
  },
  {
    id: "account",
    label: "Account",
    description: "Your name and email, and signing out",
    icon: UserRound,
    path: appUrls.settings("account"),
  },
];
