import { Link } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { periodTypeMeta, suggestionText } from "~/lib/care-periods/periodDisplay";
import { PERIOD_SHEET_STATE } from "~/lib/care-periods/periodSheets";
import { usePeriodSuggestion } from "~/lib/care-periods/periodSuggestions.sync";

/**
 * For writers on an event whose title says the recipient moved ("Admitted
 * to Mercy General"): one chip, "Start a hospital period?", that opens the
 * care period add sheet prefilled with the type, the event's time and its
 * linked practice. Closing the sheet comes back here; once the period is
 * saved the chip goes. Nothing when the period at that time is already that
 * type. Local data only, so it works offline.
 */
export function PeriodSuggestionChip({
  groupId,
  entryId,
  title,
  occurredAt,
  allDay,
}: {
  groupId: string;
  entryId: string;
  title: string | null;
  occurredAt: string;
  allDay: boolean;
}) {
  const suggestion = usePeriodSuggestion({ groupId, entryId, title, occurredAt, allDay });
  if (!suggestion) return null;
  const Icon = periodTypeMeta(suggestion.type).icon;
  return (
    <Link
      to={appUrls.newPeriod(groupId, {
        type: suggestion.type,
        startedAt: suggestion.startsAt,
        dateOnly: suggestion.dateOnly,
        place: suggestion.placeProviderId ?? undefined,
      })}
      state={PERIOD_SHEET_STATE}
      // The sheet's modules load now, so it opens offline after a full load.
      prefetch="render"
      className="btn btn-sm btn-soft btn-primary rounded-full"
      data-period-suggestion={suggestion.type}
    >
      <Icon className="size-4" aria-hidden="true" />
      {suggestionText(suggestion.type)}
    </Link>
  );
}
