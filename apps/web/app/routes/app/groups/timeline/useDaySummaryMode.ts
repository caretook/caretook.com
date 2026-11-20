import type { DaySummaryMode } from "@caretook/data/schema";

import { useState } from "react";
import { saveSettings } from "~/lib/app-shell/me";

/**
 * The day summaries' setting (off, highlights or full), per user. It switches
 * at once; offline, it's saved on the next online visit (see `saveSettings`).
 */
export function useDaySummaryMode(userId: string, initial: DaySummaryMode) {
  const [mode, setMode] = useState<DaySummaryMode>(initial);
  const changeMode = (next: DaySummaryMode) => {
    setMode(next);
    saveSettings(userId, { daySummary: next }).catch(() => undefined);
  };
  return [mode, changeMode] as const;
}
