import type { PeriodSpan } from "@caretook/data/schema";
import type { CarePeriodRow, LocalCarePeriod } from "~/lib/care-periods/carePeriods.sync";

import { useMemo } from "react";
import { useLiveQuery } from "~/lib/sync";
import { carePeriodsQuery, toPeriodSpans } from "~/lib/care-periods/carePeriods.sync";

// The timeline's care periods: the group's track (for the current-period
// line and the boundary markers), live.
// Like every timeline read, the loader reads the first rows
// (`loadTimelineRows`) and the live queries take over.

export type TimelinePeriods = {
  /** The track, oldest first, each span ending where the next starts. */
  spans: PeriodSpan<LocalCarePeriod>[];
};

export function useTimelinePeriods(
  groupId: string,
  initial: { periodRows: CarePeriodRow[] },
): TimelinePeriods {
  const periodsSql = carePeriodsQuery(groupId);
  const periodRows = useLiveQuery<CarePeriodRow>(periodsSql.sql, periodsSql.params, initial.periodRows);
  const spans = useMemo(() => toPeriodSpans(periodRows), [periodRows]);
  return { spans };
}
