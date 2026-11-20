import type { PeriodSpan } from "@caretook/data/schema";
import type { CarePeriodRow, LocalCarePeriod } from "~/lib/care-periods/carePeriods.sync";
import type { LocalQuery } from "~/lib/timeline/timeline.sync";

import { useMemo } from "react";
import { useLiveQuery } from "~/lib/sync";
import { carePeriodsQuery, toPeriodSpans } from "~/lib/care-periods/carePeriods.sync";

// The timeline's care periods: the group's track (for the current-period
// line and the boundary markers) and the names of the places they name, live.
// Like every timeline read, the loader reads the first rows
// (`loadTimelineRows`) and the live queries take over.

/** A place's name and whether it's been removed (a removed place keeps its name). */
export type PlaceNameRow = { id: string; name: string | null; deleted_at: string | null };

/** The group's providers' names, deleted ones too: only what the line and markers show. */
export const placeNamesQuery = (groupId: string): LocalQuery => ({
  sql: "SELECT id, name, deleted_at FROM provider WHERE group_id = ?",
  params: [groupId],
});

export type TimelinePeriods = {
  /** The track, oldest first, each span ending where the next starts. */
  spans: PeriodSpan<LocalCarePeriod>[];
  /** A place's name, or null (no place, or not synced yet). */
  placeName: (providerId: string | null) => string | null;
};

export function useTimelinePeriods(
  groupId: string,
  initial: { periodRows: CarePeriodRow[]; placeRows: PlaceNameRow[] },
): TimelinePeriods {
  const periodsSql = carePeriodsQuery(groupId);
  const periodRows = useLiveQuery<CarePeriodRow>(periodsSql.sql, periodsSql.params, initial.periodRows);
  const placesSql = placeNamesQuery(groupId);
  const placeRows = useLiveQuery<PlaceNameRow>(placesSql.sql, placesSql.params, initial.placeRows);
  const spans = useMemo(() => toPeriodSpans(periodRows), [periodRows]);
  const names = useMemo(() => new Map(placeRows.map((p) => [p.id, p.name])), [placeRows]);
  return { spans, placeName: (id) => (id ? (names.get(id) ?? null) : null) };
}
