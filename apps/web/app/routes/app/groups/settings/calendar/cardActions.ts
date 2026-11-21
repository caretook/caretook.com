import type { CardAction } from "./calendarPage";

import { FEED_ACTIONS } from "./feedActions";

/**
 * The Calendar & reminders cards' own posts, by `intent`: each card that
 * posts to the page (the feed's create, rotate and revoke; Google's
 * disconnect) adds its handler here, from its own file. Saving a member's
 * own settings doesn't post (`saveCalendarSettings`).
 */
export const CARD_ACTIONS: Record<string, CardAction> = {
  ...FEED_ACTIONS,
};
