import type { CalendarCardProps } from "./calendarPage";

import { SettingsCard } from "~/components/settings";
import { COMING_SOON } from "./calendarPage";

/** The member's calendar feed: create, copy, Add to…, regenerate and revoke (slice 5 fills it). */
export function FeedCard(_props: CalendarCardProps) {
  return (
    <SettingsCard id="calendar-feed" title="Calendar feed">
      <p className="text-base-content/70 text-sm">{COMING_SOON}</p>
    </SettingsCard>
  );
}
