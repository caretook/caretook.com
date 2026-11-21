import type { CalendarCardProps } from "./calendarPage";

import { SettingsCard } from "~/components/settings";
import { COMING_SOON } from "./calendarPage";

/** Reminder emails: on or off, up to three lead times, and a note on tasks (slice 6 fills it). */
export function RemindersCard(_props: CalendarCardProps) {
  return (
    <SettingsCard id="reminders" title="Reminders">
      <p className="text-base-content/70 text-sm">{COMING_SOON}</p>
    </SettingsCard>
  );
}
