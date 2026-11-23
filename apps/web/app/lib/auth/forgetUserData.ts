import { forgetGroups } from "../app-shell/lastGroup";
import { forgetSettings } from "../app-shell/me";
import { forgetMyAvatar } from "../app-shell/myAvatar";
import { forgetCalendarSettings } from "../calendars/calendarSettings";
import { forgetRecentLines } from "../assistant/recentLines";
import { forgetRecentSearches } from "../search/recentSearches";
import { forgetToggles } from "../assistant/easyModeToggle";

/**
 * The forget list: everything a user leaves in this device's localStorage
 * besides the session itself: settings and calendar settings (pending changes
 * too), last group, recent searches, quick entry's recent lines and
 * easy-mode toggles. Sign-out runs it (`wipeDevice`), and so does opening
 * the local database for a different user (`open` in lib/sync/client.ts), so
 * the next person on a shared device sees none of it (B-317).
 */
export const forgetUserData = () => {
  forgetSettings();
  forgetMyAvatar();
  forgetCalendarSettings();
  forgetGroups();
  forgetRecentSearches();
  forgetRecentLines();
  forgetToggles();
};
