import { HOME, searchString } from "../core/urls";

/** `/app?groups=1`: show the list of groups rather than going on to one. */
export const GROUP_LIST_PARAM = "groups";

/** The account's settings subpages, in list order (`/app/settings/<page>`). */
export const ACCOUNT_SETTINGS_PAGES = [
  "units",
  "timeline",
  "account",
  "contact",
  "devices",
  "not-saved",
] as const;
export type AccountSettingsPage = (typeof ACCOUNT_SETTINGS_PAGES)[number];
const isAccountSettingsPage = (page: unknown): page is AccountSettingsPage =>
  (ACCOUNT_SETTINGS_PAGES as readonly unknown[]).includes(page);

export const appShellUrls = {
  /** `/app`: the last group's timeline, the only group's, or the list of groups. */
  home: () => HOME,
  /**
   * The account's settings: the list, or one of its subpages. An unknown
   * subpage is dropped (the list).
   */
  settings: (page?: AccountSettingsPage) =>
    `${HOME}/settings${isAccountSettingsPage(page) ? `/${page}` : ""}`,
  /** `/app`'s list of groups, even when it would go on to one (easy mode's way to another group). */
  groupList: () => `${HOME}${searchString({ [GROUP_LIST_PARAM]: "1" })}`,
} as const;
