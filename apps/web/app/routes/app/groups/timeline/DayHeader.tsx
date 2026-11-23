import type { ReactNode } from "react";
import type { TimelinePeriods } from "./timelinePeriods";

import { periodAt, periodDayOn } from "@caretook/data/schema";
import { ArrowRightLeft } from "lucide-react";
import { Link } from "react-router";
import { Button, ICON, ICON_LG } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { localTimeZone } from "~/lib/core/format";
import { useGroup } from "~/lib/app-shell/group";
import { currentLineText, periodTypeMeta } from "~/lib/care-periods/periodDisplay";
import { PERIOD_SHEET_STATE } from "~/lib/care-periods/periodSheets";
import { useNow } from "~/lib/live-notes/editors.sync";
import { QuickAddMenu } from "./QuickAddMenu";
import { dayKeyIn } from "./timelineDays";

/**
 * A day section's sticky header: the day's heading ("Today", "Monday, Nov
 * 16") on the left; on the right the care period that covers the day
 * (`DayPeriod`) and, last, the writers' + menu (`QuickAddMenu`: adds start on
 * that day). The heading names the section (`day-<key>`); the period isn't part of it.
 * Under them, `summary` (the day's `DaySummaryLine`), so it stays pinned with
 * its date while the day scrolls by. Easy mode shows the period too, in
 * larger type and without Change.
 */
export function DayHeader({
  dayKey,
  label,
  newestAt,
  groupId,
  periods,
  easy = false,
  summary,
}: {
  /** The day's key ("2026-11-17", the viewer's zone). */
  dayKey: string;
  label: string;
  /** The moment of the day's newest row (an entry or a marker), or undefined for an empty day. */
  newestAt: string | undefined;
  groupId: string;
  periods: TimelinePeriods;
  easy?: boolean;
  /** The day's summary line, under the heading (inside the sticky header). */
  summary?: ReactNode;
}) {
  const { canWrite } = useGroup();
  const today = dayKey === dayKeyIn(new Date().toISOString(), localTimeZone());
  return (
    <div className="day-band text-base-content sticky top-0 z-10 px-3 py-2" data-day-header="">
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        {/* Large enough to balance the + button across from it. */}
        <h3 id={`day-${dayKey}`} className="text-lg font-semibold lg:text-xl">
          {label}
        </h3>
        {/* One group, so a long period wraps with the + and the + stays at the far right. */}
        <div className="ms-auto flex min-w-0 items-center gap-2" data-day-actions>
          {today ? (
            <TodayPeriod groupId={groupId} dayKey={dayKey} periods={periods} easy={easy} />
          ) : (
            newestAt && (
              <DayPeriod groupId={groupId} dayKey={dayKey} periods={periods} at={newestAt} easy={easy} />
            )
          )}
          {canWrite && !easy && <QuickAddMenu groupId={groupId} dayKey={dayKey} label={label} />}
        </div>
      </div>
      {summary}
    </div>
  );
}

/** Today's: the period in effect now, rechecked each minute; writers get Change. */
function TodayPeriod({
  groupId,
  dayKey,
  periods,
  easy,
}: {
  groupId: string;
  dayKey: string;
  periods: TimelinePeriods;
  easy: boolean;
}) {
  const now = useNow(60_000);
  return (
    <DayPeriod groupId={groupId} dayKey={dayKey} periods={periods} at={now} change={!easy} easy={easy} />
  );
}

/**
 * The period care was in at `at` (for a past day, its newest row: a marker
 * that day is a row, so a change that day shows the new period), as "In
 * hospital · day 4" with the type's icon, linking to the period. The number
 * counts from the start's date in the recipient's zone to this header's own
 * date, so consecutive headers never repeat one when the viewer is in another
 * zone (around midnight, Today can read a day ahead of the period's page). No
 * place: the line stays short, and the period's page shows it. Nothing before
 * the first period. With `change`, writers get Change, which opens the add sheet.
 */
function DayPeriod({
  groupId,
  dayKey,
  periods,
  at,
  change,
  easy,
}: {
  groupId: string;
  dayKey: string;
  periods: TimelinePeriods;
  at: string | number;
  change?: boolean;
  easy?: boolean;
}) {
  const group = useGroup();
  const span = periodAt(periods.spans, at);
  if (!span) return null;
  const timeZone = group.recipient?.timeZone ?? "UTC";
  const { period } = span;
  const Icon = periodTypeMeta(period.type).icon;
  const text = currentLineText(period, { day: periodDayOn(span.startsAt, dayKey, timeZone) });
  return (
    <p
      className={`text-muted flex min-w-0 items-center gap-1.5 font-normal ${easy ? "text-base" : "text-sm"}`}
      data-period-line={period.id}
    >
      <Icon className={`${easy ? ICON_LG : ICON} shrink-0`} aria-hidden="true" />
      <Link
        to={appUrls.period(groupId, period.id)}
        className="link-hover min-w-0 break-words"
        data-period-current
      >
        {text}
      </Link>
      {change && group.canWrite && (
        <Button
          to={appUrls.newPeriod(groupId)}
          state={PERIOD_SHEET_STATE}
          // Loaded ahead, so the sheet opens offline too.
          prefetch="render"
          variant="ghost"
          size="sm"
          icon={ArrowRightLeft}
          label="Change care period"
          className="-my-1 shrink-0"
          data-period-change=""
        />
      )}
    </p>
  );
}
