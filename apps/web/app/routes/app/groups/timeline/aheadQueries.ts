import type { EntryFilters, LocalQuery } from "../../../../lib/sync/timeline";

import { FUTURE_KINDS } from "@caretook/data/schema";
import { windowLinksQuery } from "../../../../lib/sync/providers";
import { upcomingQuery, upcomingWindow } from "../../../../lib/sync/timeline";

// What's ahead of the timeline's history: the Next strip's and the Upcoming
// block's local queries, built on `upcomingWindow` at the history's cutoff,
// so an item is in the history or ahead of it, never neither. (One in
// progress, or an all-day item today, is in both, by design.) Pure, so
// web:unit tests it.

/**
 * The Next strip's entries (the whole group: it ignores the kind and author
 * filters, but not the search), the Upcoming block's (under the timeline's
 * kind and author filters and the search) and the
 * block's linked providers (its "with …" lines), at `cutoff` (`historyCutoff`).
 */
export const aheadQueries = (
  groupId: string,
  filters: EntryFilters,
  cutoff: string,
): { next: LocalQuery; block: LocalQuery; blockLinks: LocalQuery } => {
  const at = new Date(cutoff);
  const match = filters.match ?? null;
  const scoped = {
    kind: filters.kind,
    author: filters.author,
    vital: filters.vital,
    ...(match && { match }),
  };
  return {
    next: upcomingQuery(groupId, { kind: null, author: null, ...(match && { match }) }, at),
    block: upcomingQuery(groupId, scoped, at),
    blockLinks: windowLinksQuery(upcomingWindow(groupId, scoped, at)),
  };
};

/**
 * What "See all in Upcoming" carries: the timeline's author filter, and its
 * kind when Upcoming lists that kind (notes and events); a symptom or vital
 * filter would find nothing there, so it's dropped.
 */
export const seeAllSearch = (filters: EntryFilters) => ({
  kind: filters.kind && (FUTURE_KINDS as readonly string[]).includes(filters.kind) ? filters.kind : null,
  author: filters.author,
});
