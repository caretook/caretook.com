import type { DaySummaryMode } from "@caretook/data/schema";

import { saveSettings } from "~/lib/app-shell/me";

/**
 * The day summaries' setting (off, highlights or full), per user. `current`
 * comes from the settings store (`useMySettings`), which a change publishes to
 * at once, so it switches straight away; offline, it's saved on the next
 * online visit (see `saveSettings`).
 */
export function useDaySummaryMode(userId: string, current: DaySummaryMode) {
  const changeMode = (next: DaySummaryMode) => {
    saveSettings(userId, { daySummary: next }).catch(() => undefined);
  };
  return [current, changeMode] as const;
}
