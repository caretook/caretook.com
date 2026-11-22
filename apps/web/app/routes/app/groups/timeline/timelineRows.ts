import type { SyncDb } from "~/lib/sync";
import type { EntryProviderLinkRow } from "~/lib/providers/entryProviders";
import type { NoteDocRow } from "~/lib/live-notes/notes.sync";
import type { EntryFilters, EntryRow, MemberRow, ReadingRow } from "~/lib/timeline/timeline.sync";
import type { CarePeriodRow } from "~/lib/care-periods/carePeriods.sync";

import { groupDocumentsQuery } from "~/lib/live-notes/notes.sync";
import { timelineLinksQuery } from "~/lib/providers/providers.sync";
import {
  fromLocalTimestamp,
  historyQuery,
  membersQuery,
  readingsQuery,
  readRows,
} from "~/lib/timeline/timeline.sync";
import { PAGE_SIZE } from "~/lib/core/paging";
import { historyCutoff } from "~/lib/appointments/upcoming";
import { carePeriodsQuery } from "~/lib/care-periods/carePeriods.sync";
import { aheadQueries } from "./aheadQueries";
import { daySummaryQuery, summariesOff, summarySince } from "./daySummaryRows";
import { localTimeZone } from "~/lib/core/format";

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
  const [entryRows, memberRows, readingRows, documentRows, linkRows, nextRows, periodRows] =
    await Promise.all([
      readRows<EntryRow>(db, historyQuery(groupId, filters, PAGE_SIZE, cutoff)),
      readRows<MemberRow>(db, membersQuery(groupId)),
      readRows<ReadingRow>(db, readingsQuery(groupId)),
      readRows<NoteDocRow>(db, groupDocumentsQuery(groupId)),
      readRows<EntryProviderLinkRow>(db, timelineLinksQuery(groupId, filters, PAGE_SIZE, cutoff)),
      readRows<EntryRow>(db, ahead.next),
      // The care periods' track (the current-period line and the markers).
      readRows<CarePeriodRow>(db, carePeriodsQuery(groupId)),
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
    periodRows,
    summaryRows,
  };
};

export type TimelineRows = Awaited<ReturnType<typeof loadTimelineRows>>;
