import type { SyncDb } from "~/lib/sync";
import type { EntryProviderLinkRow } from "~/lib/entryProviders";
import type { NoteDocRow } from "~/lib/sync/notes";
import type { EntryFilters, EntryRow, MemberRow, ReadingRow } from "~/lib/sync/timeline";

import { groupDocumentsQuery } from "~/lib/sync/notes";
import { timelineLinksQuery } from "~/lib/sync/providers";
import { entriesQuery, membersQuery, readingsQuery, readRows } from "~/lib/sync/timeline";

// The timeline's first screenful, read from the device's local copy
// (PowerSync) by the route's loader; `useTimelineData` takes over from there
// with live queries over the same rows. Its own module (no hooks), so the
// loader's chunk stays small.

/** How many entries a page adds ("Show older"). */
export const PAGE_SIZE = 30;

/** The rows the first render needs. */
export const loadTimelineRows = async (db: SyncDb, groupId: string, filters: EntryFilters) => {
  const [entryRows, memberRows, readingRows, documentRows, linkRows] = await Promise.all([
    readRows<EntryRow>(db, entriesQuery(groupId, filters, PAGE_SIZE)),
    readRows<MemberRow>(db, membersQuery(groupId)),
    readRows<ReadingRow>(db, readingsQuery(groupId)),
    readRows<NoteDocRow>(db, groupDocumentsQuery(groupId)),
    readRows<EntryProviderLinkRow>(db, timelineLinksQuery(groupId, filters, PAGE_SIZE)),
  ]);
  return { entryRows, memberRows, readingRows, documentRows, linkRows };
};

export type TimelineRows = Awaited<ReturnType<typeof loadTimelineRows>>;
