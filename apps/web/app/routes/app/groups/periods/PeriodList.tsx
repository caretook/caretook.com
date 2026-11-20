import type { PeriodSpan } from "@caretook/data/schema";
import type { LocalCarePeriod } from "~/lib/care-periods/carePeriods.sync";
import type { LocalProvider } from "~/lib/providers/providers.sync";

import { periodDay, periodLengthDays } from "@caretook/data/schema";
import { Link } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import {
  dayText,
  lengthText,
  periodTitle,
  periodTypeMeta,
  startText,
  untilText,
} from "~/lib/care-periods/periodDisplay";

/**
 * Every period on the track, newest first: its type's icon, its name and
 * label, the place (greyed "(removed)" once deleted from the directory), when
 * it started and until when ("now" for the current one), and how long. Each
 * opens the period's page.
 */
export function PeriodList({
  groupId,
  spans,
  places,
  timeZone,
  now,
}: {
  groupId: string;
  /** The track, oldest first (as `periodSpans` gives it). */
  spans: readonly PeriodSpan<LocalCarePeriod>[];
  places: ReadonlyMap<string, LocalProvider>;
  timeZone: string;
  now: Date;
}) {
  const newestFirst = [...spans].reverse();
  return (
    <ol className="divide-base-300 divide-y" aria-label="Care periods, newest first" data-period-list>
      {newestFirst.map((span) => {
        const { period } = span;
        const meta = periodTypeMeta(period.type);
        const Icon = meta.icon;
        const place = period.placeProviderId ? places.get(period.placeProviderId) : null;
        const current = span.endsAt === null;
        const length = current
          ? dayText(periodDay(span.startsAt, now, timeZone))
          : lengthText(periodLengthDays(span, now, timeZone));
        return (
          <li key={period.id} data-period={period.id} data-current={current || undefined}>
            <Link
              to={appUrls.period(groupId, period.id)}
              className="hover:bg-base-200 -mx-2 flex items-start gap-3 rounded-box px-2 py-3"
            >
              <Icon className="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium" data-period-title>
                    {periodTitle(period)}
                  </span>
                  {current && <span className="badge badge-primary badge-sm">Now</span>}
                </span>
                {(place || period.placeDetail) && (
                  <span className="text-base-content/80 block text-sm" data-period-place>
                    {place && (
                      <span className={place.deletedAt ? "text-base-content/50" : undefined}>
                        {place.name}
                        {place.deletedAt && " (removed)"}
                      </span>
                    )}
                    {place && period.placeDetail && ", "}
                    {period.placeDetail}
                  </span>
                )}
                <span className="text-base-content/70 block text-sm" data-period-dates>
                  {startText(span.startsAt, period.dateOnly, timeZone, now)} –{" "}
                  {untilText(span.endsAt, timeZone, now)}
                  {" · "}
                  {length}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
