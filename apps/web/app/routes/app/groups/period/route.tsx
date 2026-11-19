import type { Route } from "./+types/route";
import type { CarePeriodRow } from "~/lib/sync/carePeriods";
import type { ProviderRow } from "~/lib/sync/providers";

import { periodDay, periodLengthDays } from "@caretook/data/schema";
import { useMemo } from "react";
import { Link } from "react-router";
import { BackLink } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { getGroup, useGroup } from "~/lib/group";
import { dayText, lengthText, periodTitle, periodTypeMeta, startText } from "~/lib/periodDisplay";
import { sessionContext } from "~/lib/session";
import { useLiveQuery } from "~/lib/sync";
import { carePeriodsQuery, toPeriodSpans } from "~/lib/sync/carePeriods";
import { useNow } from "~/lib/sync/editors";
import { providerQuery, toProvider } from "~/lib/sync/providers";
import { loadPeriod } from "./loadPeriod";

// Shared by web + native. A care period's page: where care was, from when to
// when, and for how long. Live from the device's copy (a moved neighbour
// moves its end). Slice 2 adds its notes, contact actions, editing and the
// previous and next periods.

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `${periodTitle(loaderData.period)} · Caretook` : "Caretook" }];
}

export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  return loadPeriod(db, params.groupId, params.periodId);
}

export default function Period({ loaderData, params }: Route.ComponentProps) {
  const group = useGroup();
  const timeZone = group.recipient?.timeZone ?? "UTC";
  const tick = useNow(60_000);
  const now = useMemo(() => new Date(tick), [tick]);

  const track = carePeriodsQuery(params.groupId);
  const trackRows = useLiveQuery<CarePeriodRow>(track.sql, track.params, loaderData.trackRows);
  const { span, next } = useMemo(() => {
    const spans = toPeriodSpans(trackRows);
    const i = spans.findIndex((s) => s.period.id === params.periodId);
    return { span: spans[i] ?? null, next: i >= 0 ? (spans[i + 1] ?? null) : null };
  }, [trackRows, params.periodId]);
  const period = span?.period ?? loaderData.period;
  const placeQuery = providerQuery(period.placeProviderId ?? "");
  const placeRows = useLiveQuery<ProviderRow>(placeQuery.sql, placeQuery.params, loaderData.placeRows);
  const place = period.placeProviderId && placeRows[0] ? toProvider(placeRows[0]) : null;

  const meta = periodTypeMeta(period.type);
  const Icon = meta.icon;
  const startsAt = span?.startsAt ?? period.startedAt;

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5" data-period-page={period.id}>
      <BackLink to={appUrls.periods(params.groupId)} label="Care periods" />
      <header className="flex items-start gap-3">
        <Icon className="text-primary mt-1 size-6 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">{periodTitle(period)}</h1>
          <p className="text-base-content/70 text-sm">{meta.label}</p>
        </div>
      </header>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm" data-period-details>
        {(place || period.placeDetail) && (
          <>
            <dt className="text-base-content/70">Place</dt>
            <dd data-period-place>
              {place &&
                (place.deletedAt ? (
                  <span className="text-base-content/50">{place.name} (removed)</span>
                ) : (
                  <Link className="link" to={appUrls.provider(params.groupId, place.id)}>
                    {place.name}
                  </Link>
                ))}
              {place && period.placeDetail && ", "}
              {period.placeDetail}
            </dd>
          </>
        )}
        <dt className="text-base-content/70">Started</dt>
        <dd data-period-start>{startText(startsAt, period.dateOnly, timeZone, now)}</dd>
        <dt className="text-base-content/70">Until</dt>
        <dd data-period-end>
          {span?.endsAt
            ? startText(span.endsAt, !!next?.period.dateOnly, timeZone, now)
            : `Now · ${dayText(periodDay(startsAt, now, timeZone))}`}
        </dd>
        {span?.endsAt && (
          <>
            <dt className="text-base-content/70">Length</dt>
            <dd>{lengthText(periodLengthDays(span, now, timeZone))}</dd>
          </>
        )}
      </dl>
    </main>
  );
}
