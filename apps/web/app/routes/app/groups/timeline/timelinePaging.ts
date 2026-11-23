import { PAGE_SIZE } from "../../../../lib/core/paging";
import { recall, remember } from "../../../../lib/sync/remembered";

// The timeline's loaded pages across a remount (B-174). Sheets are child
// routes, so they keep the timeline mounted, but the entry page isn't: Back
// from it mounts the timeline again, and without this it starts at one page,
// leaving `ScrollRestoration` nothing to scroll to below the first 30 rows.
// So the timeline keeps its window here, with the rows it last showed, for
// the history entry it was on (`location.key`). Mounting on that same entry
// (Back) with the same filters starts from it, rows and all, so the first
// render is as tall as the one left; any other entry (a new navigation to
// the timeline) or other filters start at one page. One per user and group,
// in the tile cache (`remembered.ts`): memory only, cleared at sign-out.

/** The most a remembered window restores: a stale entry never loads hundreds of rows. */
export const RESTORE_CAP = 5 * PAGE_SIZE;

/** The rows the window last showed (its live queries' answers), so a restored first render needs no wait. */
export type PagingRows<E, L, S, M> = { entryRows: E[]; linkRows: L[]; summaryRows: S[]; medicationRows: M[] };

/** Where the timeline was: its history entry, filters and window. */
export type KeptPaging<E, L, S, M> = {
  locationKey: string;
  filterKey: string;
  limit: number;
  rows: PagingRows<E, L, S, M>;
};

/** How the timeline starts: the window, and the rows to show at once (none: the loader's). */
export type StartPaging<E, L, S, M> = { limit: number; rows?: PagingRows<E, L, S, M> };

const keyOf = (groupId: string) => ({ groupId, name: "timeline:paging" });

/** Keep the timeline's window for its history entry (the last one per user and group wins). */
export const keepPaging = <E, L, S, M>(userId: string, groupId: string, kept: KeptPaging<E, L, S, M>) => {
  remember(userId, keyOf(groupId), kept);
};

/** Whether a window was kept for this history entry: the timeline has been here before (Back to it), even at one page. */
export const wasKept = (userId: string, groupId: string, locationKey: string) =>
  recall<{ locationKey: string }>(userId, keyOf(groupId))?.locationKey === locationKey;

/**
 * The window to start from: the kept one when it's this history entry's and
 * these filters', capped at `RESTORE_CAP` (past the cap, no rows: the capped
 * window loads from the device like any page); otherwise one page.
 */
export const startPaging = <E, L, S, M>(
  userId: string,
  groupId: string,
  { locationKey, filterKey }: { locationKey: string; filterKey: string },
): StartPaging<E, L, S, M> => {
  const kept = recall<KeptPaging<E, L, S, M>>(userId, keyOf(groupId));
  if (!kept || kept.locationKey !== locationKey || kept.filterKey !== filterKey || kept.limit <= PAGE_SIZE)
    return { limit: PAGE_SIZE };
  if (kept.limit > RESTORE_CAP) return { limit: RESTORE_CAP };
  return { limit: kept.limit, rows: kept.rows };
};
