// The timeline's paging rules, pure: how far the window reaches, whether
// there's more, and what the list says at its end. `useTimelineData` holds
// the state; the list's `OlderEntries` shows it.

/** How many entries a page adds (scrolling near the end loads the next). */
export const PAGE_SIZE = 30;

/** The limit after loading one more page. */
export const nextLimit = (limit: number) => limit + PAGE_SIZE;

export type PageWindow = {
  /** How many entries to show. */
  limit: number;
  /** There are older entries than the shown ones. */
  hasOlder: boolean;
  /** A larger window was asked for and hasn't arrived yet. */
  loading: boolean;
};

/**
 * What the list shows. The local query asks for one row beyond its limit, so
 * `rowCount > limit` means there's more. While a larger window is on its way
 * (`fresh` is false: the rows are still the previous, one page smaller,
 * query's), the list keeps that previous window, so nothing on screen moves
 * and the end isn't announced early. Pages only grow one at a time (never
 * while loading), so the previous window is one page less, never under one.
 */
export const pageWindow = ({
  rowCount,
  requested,
  fresh,
}: {
  rowCount: number;
  requested: number;
  fresh: boolean;
}): PageWindow => {
  const loading = !fresh && requested > PAGE_SIZE;
  const limit = loading ? requested - PAGE_SIZE : requested;
  return { limit, hasOlder: rowCount > limit, loading };
};

/** The polite status at the end of the list: empty while there's nothing to say. */
export const endOfListText = ({
  empty,
  loading,
  hasOlder,
}: {
  empty: boolean;
  loading: boolean;
  hasOlder: boolean;
}) => {
  if (loading) return "Loading older…";
  if (empty || hasOlder) return "";
  return "That's the beginning of the timeline";
};
