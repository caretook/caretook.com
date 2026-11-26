import type { CalendarCardProps } from "./calendarPage";

import { DETAILS_CONSENT_TEXT } from "@caretook/data/schema";
import { SettingsCard } from "~/components/settings";
import { ToggleField } from "~/components/ui";
import { detailsConsentChange } from "~/lib/calendars/calendarSettings";
import { CalendarSaveLine } from "./CalendarSaveLine";
import { detailsCardState, detailsExplained, detailsStaleNote } from "./calendarPage";
import { useCalendarSave } from "./useCalendarSave";

const agreedOn = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * Details outside Caretook: the member's consent to titles, places and
 * providers in their emails, feed and Google calendar, for this group.
 * Saved as soon as it's switched; offline it's kept on this device and sent
 * when the connection is back. Disabled, with a note, while the group's
 * owners keep details private.
 */
export function DetailsCard({
  groupId,
  userId,
  settings,
  allowed,
  recipient,
}: CalendarCardProps & { allowed: boolean | null; recipient: string }) {
  const state = detailsCardState({ settings, allowed });
  const { status, save } = useCalendarSave(userId, groupId);

  return (
    <SettingsCard id="details-outside" title="Details outside Caretook">
      <p className="text-muted text-sm">{detailsExplained(recipient)}</p>
      {state.kind === "unknown" ? (
        <p className="text-sm" data-details-unknown="">
          Needs a connection to show your choice.
        </p>
      ) : (
        <>
          <ToggleField
            label="Include titles, places and providers"
            help={DETAILS_CONSENT_TEXT}
            checked={state.on}
            disabled={state.disabled}
            data-details-consent=""
            onChange={(event) => save(detailsConsentChange(event.target.checked))}
          />
          {state.note && (
            <p className="text-sm" data-details-forbidden="">
              {state.note}
            </p>
          )}
          {state.stale && settings?.detailsConsentAt && (
            <p className="text-sm" data-details-stale="">
              {detailsStaleNote(agreedOn(settings.detailsConsentAt))}
            </p>
          )}
          {state.on && settings?.detailsConsentAt && (
            <p className="text-muted text-sm" data-details-agreed="">
              You agreed on {agreedOn(settings.detailsConsentAt)}.
            </p>
          )}
        </>
      )}
      <CalendarSaveLine status={status} />
    </SettingsCard>
  );
}
