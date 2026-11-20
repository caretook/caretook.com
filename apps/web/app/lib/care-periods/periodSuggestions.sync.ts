import type { PeriodSuggestion } from "./periodSuggestions";
import type { CarePeriodRow } from "./carePeriods.sync";
import type { ProviderRow } from "../providers/providers.sync";

import { useMemo } from "react";
import { suggestPeriod } from "./periodSuggestions";
import { carePeriodsQuery, toPeriodSpans } from "./carePeriods.sync";
import { useLiveQuery } from "../sync/index";
import { entryProvidersQuery, toProviders } from "../providers/providers.sync";

// The care period an event suggests, read from the local database (so it
// works offline) and decided by the pure `suggestPeriod`. Live: saving the
// suggested period makes it the period at the event's time, so the
// suggestion goes away by itself.

const NO_PERIODS: CarePeriodRow[] = [];
const NO_PROVIDERS: ProviderRow[] = [];

export function usePeriodSuggestion({
  groupId,
  entryId,
  title,
  occurredAt,
  allDay,
}: {
  groupId: string;
  entryId: string;
  /** The title as it is now (typed or saved). */
  title: string | null;
  occurredAt: string;
  allDay: boolean;
}): PeriodSuggestion | null {
  const periods = carePeriodsQuery(groupId);
  const periodRows = useLiveQuery<CarePeriodRow>(periods.sql, periods.params, NO_PERIODS);
  const linked = entryProvidersQuery(entryId);
  const providerRows = useLiveQuery<ProviderRow>(linked.sql, linked.params, NO_PROVIDERS);

  const spans = useMemo(() => toPeriodSpans(periodRows), [periodRows]);
  const providers = useMemo(() => toProviders(providerRows), [providerRows]);
  // Before the first read, the track isn't known: say nothing rather than flash a chip.
  const read = periodRows !== NO_PERIODS;

  return useMemo(
    () => (read ? suggestPeriod({ title, occurredAt, allDay, spans, providers }) : null),
    [read, title, occurredAt, allDay, spans, providers],
  );
}
