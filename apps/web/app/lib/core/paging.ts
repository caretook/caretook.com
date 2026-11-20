// Paging rules for a growing local list (the timeline, Upcoming's Past tab),
// pure: how far the window reaches, whether there's more, and what the list
// says at its end. A screen's data hook holds the state; `OlderEntries`
// (`components/entry`) shows it.

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
 * (`fresh` is false and `requested` is past `settled`: the rows are still the
 * smaller query's), the list keeps that previous window, so nothing on screen
 * moves and the end isn't announced early. `settled` is the limit the rows on
 * screen were fetched for; a query that changes for another reason (the
 * timeline's cutoff moving on at the minute's turn) isn't loading, so the
 * window stays whole. Without `settled`, pages grow one at a time (never
 * while loading), so the previous window is one page less, never under one.
 */
export const pageWindow = ({
  rowCount,
  requested,
  fresh,
  settled = Math.max(PAGE_SIZE, requested - PAGE_SIZE),
}: {
  rowCount: number;
  requested: number;
  fresh: boolean;
  settled?: number;
}): PageWindow => {
  const loading = !fresh && requested > settled;
  const limit = loading ? settled : requested;
  return { limit, hasOlder: rowCount > limit, loading };
};

/** What the timeline says once there's nothing older. */
export const TIMELINE_END_TEXT = "That's the beginning of the timeline";

/**
 * The polite status at the end of the list: empty while there's nothing to
 * say. `endText` is what it says once there's nothing older (the timeline's
 * by default).
 */
export const endOfListText = ({
  empty,
  loading,
  hasOlder,
  endText = TIMELINE_END_TEXT,
}: {
  empty: boolean;
  loading: boolean;
  hasOlder: boolean;
  endText?: string;
}) => {
  if (loading) return "Loading older…";
  if (empty || hasOlder) return "";
  return endText;
};
