import type { CalendarCardProps } from "./calendarPage";

import { useId } from "react";
import { SettingsCard } from "~/components/settings";
import { CheckField, ToggleField } from "~/components/ui";
import { CalendarSaveLine } from "./CalendarSaveLine";
import { LEADS_CAP_NOTE, leadChoices, REMINDERS_EXPLAINED, TODOS_NOTE, withLead } from "./reminderChoices";
import { useCalendarSave } from "./useCalendarSave";

/**
 * Reminder emails for this group: on or off, and up to three lead times
 * (the preset is the evening before and 1 h before), with a note that
 * todos reach their assignee. The member's own, viewers included; saved as
 * soon as it's changed, and kept on this device offline (useCalendarSave).
 */
export function RemindersCard({ groupId, userId, settings }: CalendarCardProps) {
  const { status, save } = useCalendarSave(userId, groupId);
  const capId = useId();
  const leads = settings?.reminderLeads ?? [];

  return (
    <SettingsCard id="reminders" title="Reminders">
      <p className="text-base-content/70 text-sm">{REMINDERS_EXPLAINED}</p>
      {!settings ? (
        <p className="text-sm" data-reminders-unknown="">
          Needs a connection to show your reminders.
        </p>
      ) : (
        <>
          <ToggleField
            label="Email me reminders"
            checked={settings.remindersOn}
            data-reminders-on=""
            onChange={(event) => save({ remindersOn: event.target.checked })}
          />
          {settings.remindersOn && (
            <fieldset className="flex flex-col gap-2" aria-describedby={capId} data-reminder-leads="">
              <legend className="mb-1 text-sm font-medium">When</legend>
              {leadChoices(leads).map((choice) => (
                <CheckField
                  key={choice.lead}
                  label={choice.label}
                  checked={choice.checked}
                  disabled={choice.disabled}
                  onChange={(event) =>
                    save({ reminderLeads: withLead(leads, choice.lead, event.target.checked) })
                  }
                />
              ))}
              <p id={capId} className="text-base-content/70 text-sm">
                {LEADS_CAP_NOTE}
              </p>
            </fieldset>
          )}
          <p className="text-base-content/70 text-sm" data-reminders-todos="">
            {TODOS_NOTE}
          </p>
        </>
      )}
      <CalendarSaveLine status={status} />
    </SettingsCard>
  );
}
