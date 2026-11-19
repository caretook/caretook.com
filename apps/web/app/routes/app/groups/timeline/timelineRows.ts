import type { SyncDb } from "~/lib/sync";
import type { EntryProviderLinkRow } from "~/lib/entryProviders";
import type { NoteDocRow } from "~/lib/sync/notes";
import type { EntryFilters, EntryRow, MemberRow, ReadingRow } from "~/lib/sync/timeline";

import { groupDocumentsQuery } from "~/lib/sync/notes";
import { timelineLinksQuery } from "~/lib/sync/providers";
import { historyQuery, membersQuery, readingsQuery, readRows } from "~/lib/sync/timeline";
import { PAGE_SIZE } from "~/lib/paging";
import { historyCutoff } from "~/lib/upcoming";
import { aheadQueries } from "./aheadQueries";

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
  const [entryRows, memberRows, readingRows, documentRows, linkRows, nextRows, blockRows, blockLinkRows] =
    await Promise.all([
      readRows<EntryRow>(db, historyQuery(groupId, filters, PAGE_SIZE, cutoff)),
      readRows<MemberRow>(db, membersQuery(groupId)),
      readRows<ReadingRow>(db, readingsQuery(groupId)),
      readRows<NoteDocRow>(db, groupDocumentsQuery(groupId)),
      readRows<EntryProviderLinkRow>(db, timelineLinksQuery(groupId, filters, PAGE_SIZE, cutoff)),
      readRows<EntryRow>(db, ahead.next),
      readRows<EntryRow>(db, ahead.block),
      readRows<EntryProviderLinkRow>(db, ahead.blockLinks),
    ]);
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
  };
};

export type TimelineRows = Awaited<ReturnType<typeof loadTimelineRows>>;
