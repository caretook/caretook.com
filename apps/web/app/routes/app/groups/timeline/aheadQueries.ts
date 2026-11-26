import type { EntryFilters, LocalQuery } from "../../../../lib/timeline/timeline.sync";

import { upcomingQuery } from "../../../../lib/timeline/timeline.sync";

// What's ahead of the timeline's history: the Today card's appointment row's
// local query, built on `upcomingWindow` at the history's cutoff, so an item
// is in the history or ahead of it, never neither. (One in progress, or an
// all-day item today, is in both, by design.) Pure, so web:unit tests it.

/**
 * The entries ahead (the whole group: it ignores the kind, author and tag
 * filters, but not the search), at `cutoff` (`historyCutoff`).
 */
export const aheadQueries = (
  groupId: string,
  filters: EntryFilters,
  cutoff: string,
): { next: LocalQuery } => {
  const match = filters.match ?? null;
  return {
    next: upcomingQuery(groupId, { kind: null, author: null, ...(match && { match }) }, new Date(cutoff)),
  };
};
