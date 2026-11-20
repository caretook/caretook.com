import type { TimelineView } from "@caretook/data/schema";

import { saveSettings } from "~/lib/app-shell/me";

/**
 * The rows/cards layout, a per-user setting. `current` comes from the
 * settings store (`useMySettings`), which a change publishes to at once, so it
 * switches straight away; offline, it's saved on the next online visit (see
 * `saveSettings`).
 */
export function useTimelineView(userId: string, current: TimelineView) {
  const changeView = (next: TimelineView) => {
    saveSettings(userId, { timelineView: next }).catch(() => undefined);
  };
  return [current, changeView] as const;
}
