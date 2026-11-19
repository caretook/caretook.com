import type { TimelinePeriods } from "./timelinePeriods";

import { currentPeriod } from "@caretook/data/schema";
import { MapPin } from "lucide-react";
import { Link } from "react-router";
import { appUrls } from "~/lib/appUrls";
import { useGroup } from "~/lib/group";
import { currentLineText, periodTypeMeta } from "~/lib/periodDisplay";
import { PERIOD_SHEET_STATE } from "~/lib/periodSheets";
import { useNow } from "~/lib/sync/editors";
import { STRIP_ACTION, STRIP_CLASS, STRIP_ICON } from "./layout";

/**
 * Where the recipient is now: "In hospital · Mercy General · day 4", with
 * the type's icon, linking to the period. Writers get Change, which opens
 * the add sheet (closing it comes back here). With no periods yet, writers
 * are asked "Where is Pat now?"; viewers see nothing. Ignores the filters.
 * Days count in the recipient's zone, turning over within a minute.
 */
export function CurrentPeriodLine({ groupId, periods }: { groupId: string; periods: TimelinePeriods }) {
  const group = useGroup();
  const now = useNow(60_000);
  const timeZone = group.recipient?.timeZone ?? "UTC";
  const current = currentPeriod(periods.spans, now, timeZone);

  if (!current) {
    if (!group.canWrite) return null;
    return (
      <section aria-label="Care period" data-period-line="empty" className={STRIP_CLASS}>
        <MapPin className={`${STRIP_ICON} text-base-content/70`} aria-hidden="true" />
        <p className="text-base-content/70 min-w-0 flex-1 py-1">
          Where is {group.recipient?.displayName || group.displayName} now?
        </p>
        <Link
          to={appUrls.newPeriod(groupId)}
          state={PERIOD_SHEET_STATE}
          // Loaded ahead, so the sheet opens offline too.
          prefetch="render"
          className={STRIP_ACTION}
          data-period-add
        >
          Add care period
        </Link>
      </section>
    );
  }

  const { period } = current.span;
  const Icon = periodTypeMeta(period.type).icon;
  const text = currentLineText(period, {
    placeName: periods.placeName(period.placeProviderId),
    day: current.day,
  });
  return (
    <section aria-label="Care period" data-period-line={period.id} className={STRIP_CLASS}>
      <Icon className={`${STRIP_ICON} text-base-content/70`} aria-hidden="true" />
      <Link
        to={appUrls.period(groupId, period.id)}
        className="link-hover min-w-0 flex-1 py-1 break-words"
        data-period-current
      >
        {text}
      </Link>
      {group.canWrite && (
        <Link
          to={appUrls.newPeriod(groupId)}
          state={PERIOD_SHEET_STATE}
          prefetch="render"
          className={STRIP_ACTION}
          aria-label="Change care period"
          data-period-change
        >
          Change
        </Link>
      )}
    </section>
  );
}
