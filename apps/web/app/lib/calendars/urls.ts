import { careGroupUrls } from "../care-groups/urls";

export const calendarUrls = {
  /** A group's "Calendar & reminders" page (a group settings subpage): reminders, the feed, Google and details. */
  calendarSettings: (groupId: string) => careGroupUrls.groupSettings(groupId, "calendar"),
} as const;
