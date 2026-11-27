import type { ProvidersView } from "@caretook/data/schema";

import { saveSettings, useCachedSettings } from "~/lib/app-shell/me";

/**
 * The providers list's Condensed/Full layout, a per-user setting of its own
 * (`providersView`, apart from the timeline's). It reads the settings store
 * live (`useCachedSettings`), which a change publishes to at once, so it
 * switches straight away; offline, it's saved on the next online visit (see
 * `saveSettings`).
 */
export function useProvidersView(userId: string) {
  const current = useCachedSettings(userId).providersView;
  const changeView = (next: ProvidersView) => {
    saveSettings(userId, { providersView: next }).catch(() => undefined);
  };
  return [current, changeView] as const;
}
