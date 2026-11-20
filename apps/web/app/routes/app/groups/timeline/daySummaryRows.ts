import type { EntryFilters, LocalQuery } from "~/lib/timeline/timeline.sync";

import { FUTURE_KINDS } from "@caretook/data/schema";
import { SHOWN_KINDS_SQL, toLocalTimestamp } from "~/lib/timeline/timeline.sync";
import { baselineStart } from "./daySummary";
import { dayKeyIn } from "./timelineDays";

const FUTURE_KINDS_SQL = `kind IN (${FUTURE_KINDS.map((k) => `'${k}'`).join(", ")})`;

/** Where the summaries' rows start: the baseline of the oldest loaded day (today's when nothing is loaded). */
export const summarySince = (oldestLoaded: string | null, cutoff: string, timeZone: string) =>
  baselineStart(dayKeyIn(oldestLoaded ?? cutoff, timeZone));

/**
 * The day summaries' rows: every shown kind's live entries from `since` up to
 * the history's end (`historyWindow`'s rule), unfiltered, newest first. Whole
 * days, so the oldest loaded day's summary covers all of it even when the
 * page ends partway through. `off` (a filter or search is on) reads nothing.
 */
export const daySummaryQuery = (
  groupId: string,
  since: string,
  cutoff: string,
  off: boolean,
): LocalQuery => ({
  sql: `SELECT * FROM timeline_entry
        WHERE group_id = ? AND deleted_at IS NULL AND ${SHOWN_KINDS_SQL} ${off ? "AND 0" : ""}
          AND occurred_at >= ? AND (NOT ${FUTURE_KINDS_SQL} OR occurred_at <= ?)
        ORDER BY occurred_at DESC, id DESC`,
  params: [groupId, toLocalTimestamp(since), toLocalTimestamp(cutoff)],
});

/** Summaries are hidden (and not read) while any filter or search is on. */
export const summariesOff = (filters: EntryFilters) =>
  !!(filters.kind || filters.author || filters.vital || filters.match);
