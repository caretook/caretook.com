import type { PeriodChoice, SearchablePeriod } from "./periodSearch";
import type { CarePeriodRow, LocalCarePeriod } from "./carePeriods.sync";
import type { SyncDb } from "../sync/index";
import type { LocalQuery } from "../timeline/timeline.sync";

import { useMemo } from "react";
import { periodChoices } from "./periodSearch";
import { toCarePeriod } from "./carePeriods.sync";
import { useNow } from "../live-notes/editors.sync";
import { useLiveQuery } from "../sync/index";
import { readRows } from "../timeline/timeline.sync";
import type { PeriodSpan } from "@caretook/data/domain";
import { periodRange, periodSpans } from "@caretook/data/domain";

// The care periods a search can be narrowed to, read locally: the group's
// live periods with their place's name (one query), as choices
// (`lib/care-periods/periodSearch`). Used by the search page and the timeline's search.

export type SearchPeriodRow = CarePeriodRow & { place_name: string | null };

/** The group's live periods in track order, each with its place's name (a removed place keeps its name). */
export const searchPeriodsQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT c.*, p.name AS place_name FROM care_period c
        LEFT JOIN provider p ON p.id = c.place_provider_id AND p.group_id = c.group_id
        WHERE c.group_id = ? AND c.deleted_at IS NULL
        ORDER BY c.started_at, c.created_at, c.id`,
  params: [groupId],
});

/** The rows for a loader, so the first render has the choices. */
export const loadSearchPeriods = (db: SyncDb, groupId: string) =>
  readRows<SearchPeriodRow>(db, searchPeriodsQuery(groupId));

/** The track from these rows. */
export const toSearchSpans = (
  rows: readonly SearchPeriodRow[],
): PeriodSpan<LocalCarePeriod & SearchablePeriod>[] =>
  periodSpans(
    rows.flatMap((row) => {
      const period = toCarePeriod(row);
      return period ? [{ ...period, placeName: row.place_name }] : [];
    }),
  );

/** The choices from these rows, newest first. */
export const searchPeriodChoices = (rows: readonly SearchPeriodRow[], timeZone: string, now: Date) =>
  periodChoices(toSearchSpans(rows), timeZone, now);

/** The group's period choices, live (they follow edits on any device); `initial` from `loadSearchPeriods`. */
export function useSearchPeriods(
  groupId: string,
  initial: SearchPeriodRow[],
  timeZone: string,
): PeriodChoice[] {
  const query = searchPeriodsQuery(groupId);
  const rows = useLiveQuery<SearchPeriodRow>(query.sql, query.params, initial);
  // Once a minute: only the dates' years depend on it.
  const tick = useNow(60_000);
  return useMemo(() => searchPeriodChoices(rows, timeZone, new Date(tick)), [rows, timeZone, tick]);
}

/** The range of the period `periodId` from these rows, or null (none asked for, or not on the track). */
export const searchPeriodRange = (rows: readonly SearchPeriodRow[], periodId: string | null) =>
  periodId ? periodRange(toSearchSpans(rows), periodId) : null;
