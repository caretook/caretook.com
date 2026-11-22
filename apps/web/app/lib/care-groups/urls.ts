import { groupHome, HOME } from "../core/urls";

/** A group's settings subpages, in list order (`…/settings/<page>`). */
export const GROUP_SETTINGS_PAGES = ["details", "members", "assistants", "calendar"] as const;
export type GroupSettingsPage = (typeof GROUP_SETTINGS_PAGES)[number];
const isGroupSettingsPage = (page: unknown): page is GroupSettingsPage =>
  (GROUP_SETTINGS_PAGES as readonly unknown[]).includes(page);

export const careGroupUrls = {
  /**
   * A group's settings: the list, or one of its subpages. An unknown subpage
   * is dropped (the list).
   */
  groupSettings: (groupId: string, page?: GroupSettingsPage) =>
    `${groupHome(groupId)}/settings${isGroupSettingsPage(page) ? `/${page}` : ""}`,
  /** Start another care group: who you care for, then its timeline. */
  newGroup: () => `${HOME}/groups/new`,
} as const;
