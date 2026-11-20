import type { TimelineView } from "@caretook/data/schema";

import { useState } from "react";
import { saveSettings } from "~/lib/app-shell/me";

/**
 * The rows/cards layout, a per-user setting. It switches at once; offline,
 * it's saved on the next online visit (see `saveSettings`).
 */
export function useTimelineView(userId: string, initial: TimelineView) {
  const [view, setView] = useState<TimelineView>(initial);
  const changeView = (next: TimelineView) => {
    setView(next);
    saveSettings(userId, { timelineView: next }).catch(() => undefined);
  };
  return [view, changeView] as const;
}
