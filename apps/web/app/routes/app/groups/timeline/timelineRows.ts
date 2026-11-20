import type { SyncDb } from "~/lib/sync";
import type { EntryProviderLinkRow } from "~/lib/entryProviders";
import type { NoteDocRow } from "~/lib/sync/notes";
import type { EntryFilters, EntryRow, MemberRow, ReadingRow } from "~/lib/sync/timeline";
import type { CarePeriodRow } from "~/lib/sync/carePeriods";
import type { PlaceNameRow } from "./timelinePeriods";

import { groupDocumentsQuery } from "~/lib/sync/notes";
import { timelineLinksQuery } from "~/lib/sync/providers";
import { fromLocalTimestamp, historyQuery, membersQuery, readingsQuery, readRows } from "~/lib/sync/timeline";
import { PAGE_SIZE } from "~/lib/paging";
import { historyCutoff } from "~/lib/upcoming";
import { carePeriodsQuery } from "~/lib/sync/carePeriods";
import { aheadQueries } from "./aheadQueries";
import { placeNamesQuery } from "./timelinePeriods";
import { daySummaryQuery, summariesOff, summarySince } from "./daySummaryRows";
import { localTimeZone } from "~/lib/format";

// The timeline's first screenful, read from the device's local copy
// (PowerSync) by the route's loader; `useTimelineData` takes over from there
// with live queries over the same rows. Its own module (no hooks), so the
// loader's chunk stays small.

/** The rows the first render needs: the history up to `cutoff`, and what's ahead of it. */
export const loadTimelineRows = async (
  db: SyncDb,
  groupId: string,
  filters: EntryFilters,
  cutoff = historyCutoff(new Date()),
) => {
  const ahead = aheadQueries(groupId, filters, cutoff);
  const [
    entryRows,
    memberRows,
    readingRows,
    documentRows,
    linkRows,
    nextRows,
    blockRows,
    blockLinkRows,
    periodRows,
    placeRows,
  ] = await Promise.all([
    readRows<EntryRow>(db, historyQuery(groupId, filters, PAGE_SIZE, cutoff)),
    readRows<MemberRow>(db, membersQuery(groupId)),
    readRows<ReadingRow>(db, readingsQuery(groupId)),
    readRows<NoteDocRow>(db, groupDocumentsQuery(groupId)),
    readRows<EntryProviderLinkRow>(db, timelineLinksQuery(groupId, filters, PAGE_SIZE, cutoff)),
    readRows<EntryRow>(db, ahead.next),
    readRows<EntryRow>(db, ahead.block),
    readRows<EntryProviderLinkRow>(db, ahead.blockLinks),
    // The care periods' track and its places (the current-period line and the markers).
    readRows<CarePeriodRow>(db, carePeriodsQuery(groupId)),
    readRows<PlaceNameRow>(db, placeNamesQuery(groupId)),
  ]);
  const oldest = entryRows.at(-1)?.occurred_at;
  // The day summaries: whole days from the oldest loaded one's baseline (none while filtered).
  const since = summarySince(oldest ? fromLocalTimestamp(oldest) : null, cutoff, localTimeZone());
  const summaryRows = await readRows<EntryRow>(
    db,
    daySummaryQuery(groupId, since, cutoff, summariesOff(filters)),
  );
  return {
    cutoff,
    entryRows,
    memberRows,
    readingRows,
    documentRows,
    linkRows,
    nextRows,
    blockRows,
    blockLinkRows,
    periodRows,
    placeRows,
    summaryRows,
  };
};

export type TimelineRows = Awaited<ReturnType<typeof loadTimelineRows>>;
