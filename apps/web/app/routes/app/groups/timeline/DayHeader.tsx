import type { ReactNode } from "react";
import type { TimelinePeriods } from "./timelinePeriods";

import { periodAt, periodDay } from "@caretook/data/schema";
import { Link } from "react-router";
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
 * 16") with, for writers, its + menu (`QuickAddMenu`: adds start on that
 * day), and beside them the care period that covers the day (`DayPeriod`).
 * The heading names the section (`day-<key>`); the period isn't part of it.
 * Under them, `summary` (the day's `DaySummaryLine`), so it stays pinned with
 * its date while the day scrolls by. Simple mode shows no period.
 */
export function DayHeader({
  dayKey,
  label,
  newestAt,
  groupId,
  periods,
  simple = false,
  summary,
}: {
  /** The day's key ("2026-11-17", the viewer's zone). */
  dayKey: string;
  label: string;
  /** The moment of the day's newest row (an entry or a marker), or undefined for an empty day. */
  newestAt: string | undefined;
  groupId: string;
  periods: TimelinePeriods;
  simple?: boolean;
  /** The day's summary line, under the heading (inside the sticky header). */
  summary?: ReactNode;
}) {
  const { canWrite } = useGroup();
  const today = dayKey === dayKeyIn(new Date().toISOString(), localTimeZone());
  return (
    <div
      className="bg-base-200/95 text-base-content sticky top-0 z-10 -mx-1 px-1 py-2 backdrop-blur"
      data-day-header=""
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <div className="flex items-center gap-2">
          {/* Large enough to balance the + button beside it. */}
          <h3 id={`day-${dayKey}`} className="text-lg font-semibold lg:text-xl">
            {label}
          </h3>
          {canWrite && !simple && <QuickAddMenu groupId={groupId} dayKey={dayKey} label={label} />}
        </div>
        {simple ? null : today ? (
          <TodayPeriod groupId={groupId} periods={periods} />
        ) : (
          newestAt && <DayPeriod groupId={groupId} periods={periods} at={newestAt} />
        )}
      </div>
      {summary}
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
 * hospital · day 4" (days counted in the recipient's zone) with the type's
 * icon, linking to the period. No place: the line stays short, and the
 * period's page shows it. Nothing before the first period. With `change`,
 * writers get Change, which opens the add sheet.
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
  const text = currentLineText(period, { day: periodDay(span.startsAt, at, timeZone) });
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
