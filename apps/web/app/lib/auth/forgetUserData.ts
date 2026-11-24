import { forgetGroups } from "../app-shell/lastGroup";
import { forgetSettings } from "../app-shell/me";
import { forgetMyAvatar } from "../app-shell/myAvatar";
import { forgetCalendarSettings } from "../calendars/calendarSettings";
import { forgetRecentLines } from "../assistant/recentLines";
import { forgetRecentSearches } from "../search/recentSearches";
import { forgetToggles } from "../assistant/easyModeToggle";

/**
 * The pending (unsent) settings changes: the account's settings, its avatar
 * and its calendar settings (the prefixes in me.ts, myAvatar.ts and
 * calendarSettings.ts). A kept local copy keeps them for its owner.
 */
const PENDING_PREFIXES = [
  "caretook:settings-pending:",
  "caretook:avatar-pending:",
  "caretook:calendar-pending:",
];

const pendingEntries = (): [string, string][] => {
  try {
    return Object.keys(localStorage)
      .filter((key) => PENDING_PREFIXES.some((prefix) => key.startsWith(prefix)))
      .map((key) => [key, localStorage.getItem(key) ?? ""]);
  } catch {
    return [];
  }
};

/**
 * The forget list: everything a user leaves in this device's localStorage
 * besides the session itself: settings and calendar settings (pending changes
 * too), last group, recent searches, quick entry's recent lines and
 * easy-mode toggles. Sign-out runs it (`wipeDevice`), and so does opening
 * the local database for a different user (`open` in lib/sync/client.ts), so
 * the next person on a shared device sees none of it (B-317).
 *
 * `keepPending`: a session the server ended with changes waiting keeps the
 * local copy for its owner (B-290), and their unsent settings changes with it,
 * so they're sent after the owner's next sign-in. The rest goes.
 */
export const forgetUserData = ({ keepPending = false }: { keepPending?: boolean } = {}) => {
  const kept = keepPending ? pendingEntries() : [];
  forgetSettings();
  forgetMyAvatar();
  forgetCalendarSettings();
  forgetGroups();
  forgetRecentSearches();
  forgetRecentLines();
  forgetToggles();
  try {
    for (const [key, value] of kept) localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: nothing was kept.
  }
};
