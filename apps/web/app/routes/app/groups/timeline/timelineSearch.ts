import type { EntryCondition } from "../../../../lib/sync/timeline";
import type { SearchIndexStatus, SearchRange } from "../../../../lib/sync/search";

import { parseSearch } from "@caretook/data/schema";
import { entryMatchCondition, entryRangeCondition } from "../../../../lib/sync/search";

// The timeline's search (`?q=`) as its queries take it: a condition on the
// entry's id for every window (`EntryFilters.match`), and what the screen
// says about it. Pure, so web:unit tests it.

/**
 * What the search is doing:
 * - `none`: no search.
 * - `ready`: matching through the device's index.
 * - `empty`: only exclusions (`-word`), which match nothing.
 * - `preparing`: the index is being built; nothing shows until it's ready.
 * - `unavailable`: the index couldn't be built on this device.
 */
export type TimelineSearchState = "none" | "ready" | "empty" | "preparing" | "unavailable";

export type TimelineSearch = { state: TimelineSearchState; match: EntryCondition | null };

/** A condition no entry meets: the list stays empty while there's nothing to search with. */
export const NO_MATCH: EntryCondition = { sql: "0", params: [] };

const NONE: TimelineSearch = { state: "none", match: null };

/**
 * The search for `q` (from `parseFilters`) in one group, given the index's
 * status, and narrowed to a care period's dates when there's a `range`
 * (`periodRange`; an open period has no end, and the history ends at now).
 */
export const timelineSearch = (
  groupId: string,
  q: string,
  status: SearchIndexStatus,
  range: SearchRange | null = null,
): TimelineSearch => {
  if (!q) return NONE;
  if (status === "preparing") return { state: "preparing", match: NO_MATCH };
  if (status === "unavailable") return { state: "unavailable", match: NO_MATCH };
  const match = entryMatchCondition("timeline_entry.id", groupId, parseSearch(q));
  if (!match) return { state: "empty", match: NO_MATCH };
  if (!range) return { state: "ready", match };
  const within = entryRangeCondition("timeline_entry.occurred_at", range);
  return {
    state: "ready",
    match: { sql: `${match.sql} AND ${within.sql}`, params: [...match.params, ...within.params] },
  };
};

/** What the list says at its end while searching (else the timeline's own). */
export const SEARCH_END_TEXT = "That's every match.";

/** The status line's words for a state that shows no entries, or null. */
export const searchStateText = (state: TimelineSearchState) =>
  state === "preparing"
    ? "Preparing search…"
    : state === "unavailable"
      ? "Search isn't available on this device."
      : state === "empty"
        ? "Add a word to search for: exclusions alone match nothing."
        : null;

/**
 * The polite announcement of a search's result: how many entries the list
 * shows ("30+" while older ones are still to load), or why it shows none.
 * Null without a search. `emptyText` is what the empty list says.
 */
export const searchAnnouncement = ({
  q,
  state,
  shown,
  hasOlder,
  emptyText,
}: {
  q: string;
  state: TimelineSearchState;
  shown: number;
  hasOlder: boolean;
  emptyText: string;
}) => {
  if (state === "none" || !q) return null;
  const stateText = searchStateText(state);
  if (stateText) return stateText;
  if (shown === 0) return emptyText;
  const count = hasOlder
    ? `${shown}+ entries match`
    : shown === 1
      ? "1 entry matches"
      : `${shown} entries match`;
  return `${count} “${q}”.`;
};
