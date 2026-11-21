import type { CalendarCardProps } from "./calendarPage";

import { SettingsCard } from "~/components/settings";
import { COMING_SOON } from "./calendarPage";

/** Google Calendar: Connect, or the status with Disconnect; web only (slice 7 fills it). */
export function GoogleCard(_props: CalendarCardProps) {
  return (
    <SettingsCard id="google-calendar" title="Google Calendar">
      <p className="text-base-content/70 text-sm">{COMING_SOON}</p>
    </SettingsCard>
  );
}
