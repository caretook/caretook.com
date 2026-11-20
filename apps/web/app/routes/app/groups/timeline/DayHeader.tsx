import type { TimelinePeriods } from "./timelinePeriods";

import { periodAt, periodDay } from "@caretook/data/schema";
import { Link } from "react-router";
import { appUrls } from "~/lib/appUrls";
import { localTimeZone } from "~/lib/format";
import { useGroup } from "~/lib/group";
import { currentLineText, periodTypeMeta } from "~/lib/periodDisplay";
import { PERIOD_SHEET_STATE } from "~/lib/periodSheets";
import { useNow } from "~/lib/sync/editors";
import { dayKeyIn } from "./timelineDays";

/**
 * A day section's sticky header: the day's heading ("Today", "Monday, Nov
 * 16") and, beside it, the care period that covers the day (`DayPeriod`).
 * The heading names the section (`day-<key>`); the period isn't part of it.
 */
export function DayHeader({
  dayKey,
  label,
  newestAt,
  groupId,
  periods,
}: {
  /** The day's key ("2026-11-17", the viewer's zone). */
  dayKey: string;
  label: string;
  /** The moment of the day's newest row (an entry or a marker), or undefined for an empty day. */
  newestAt: string | undefined;
  groupId: string;
  periods: TimelinePeriods;
}) {
  const today = dayKey === dayKeyIn(new Date().toISOString(), localTimeZone());
  return (
    <div
      className="bg-base-200/95 text-base-content sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-x-3 px-1 py-2 backdrop-blur"
      data-day-header=""
    >
      <h3 id={`day-${dayKey}`} className="text-base font-semibold lg:text-lg">
        {label}
      </h3>
      {today ? (
        <TodayPeriod groupId={groupId} periods={periods} />
      ) : (
        newestAt && <DayPeriod groupId={groupId} periods={periods} at={newestAt} />
      )}
    </div>
  );
}

/** Today's: the current period, its day turning over within a minute; writers get Change. */
function TodayPeriod({ groupId, periods }: { groupId: string; periods: TimelinePeriods }) {
  const now = useNow(60_000);
  return <DayPeriod groupId={groupId} periods={periods} at={now} change />;
}

/**
 * The period care was in at `at` (for a past day, its newest row: a marker
 * that day is a row, so a change that day shows the new period), as "In
 * hospital · Mercy General · day 4" (days counted in the recipient's zone)
 * with the type's icon, linking to the period. Nothing before the first
 * period. With `change`, writers get Change, which opens the add sheet.
 */
function DayPeriod({
  groupId,
  periods,
  at,
  change,
}: {
  groupId: string;
  periods: TimelinePeriods;
  at: string | number;
  change?: boolean;
}) {
  const group = useGroup();
  const span = periodAt(periods.spans, at);
  if (!span) return null;
  const timeZone = group.recipient?.timeZone ?? "UTC";
  const { period } = span;
  const Icon = periodTypeMeta(period.type).icon;
  const text = currentLineText(period, {
    placeName: periods.placeName(period.placeProviderId),
    day: periodDay(span.startsAt, at, timeZone),
  });
  return (
    <p
      className="text-base-content/70 flex min-w-0 items-center gap-1.5 text-sm font-normal"
      data-period-line={period.id}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <Link
        to={appUrls.period(groupId, period.id)}
        className="link-hover min-w-0 break-words"
        data-period-current
      >
        {text}
      </Link>
      {change && group.canWrite && (
        <Link
          to={appUrls.newPeriod(groupId)}
          state={PERIOD_SHEET_STATE}
          // Loaded ahead, so the sheet opens offline too.
          prefetch="render"
          className="btn btn-ghost btn-xs text-base-content/70 shrink-0"
          aria-label="Change care period"
          data-period-change
        >
          Change
        </Link>
      )}
    </p>
  );
}
