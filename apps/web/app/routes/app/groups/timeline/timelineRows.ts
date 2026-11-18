import type { TimelineEntryKind } from "@caretook/data/schema";
import type { SyncDb } from "~/lib/sync";
import type { NoteDocRow } from "~/lib/sync/notes";
import type { EntryRow, MemberRow, ReadingRow } from "~/lib/sync/timeline";

import { groupDocumentsQuery } from "~/lib/sync/notes";
import { entriesQuery, membersQuery, readingsQuery, readRows } from "~/lib/sync/timeline";

// The timeline's first screenful, read from the device's local copy
// (PowerSync) by the route's loader; `useTimelineData` takes over from there
// with live queries over the same rows. Its own module (no hooks), so the
// loader's chunk stays small.

/** How many entries a page adds ("Show older"). */
export const PAGE_SIZE = 30;

/** The rows the first render needs. */
export const loadTimelineRows = async (db: SyncDb, groupId: string, kind: TimelineEntryKind | null) => {
  const [entryRows, memberRows, readingRows, documentRows] = await Promise.all([
    readRows<EntryRow>(db, entriesQuery(groupId, kind, PAGE_SIZE)),
    readRows<MemberRow>(db, membersQuery(groupId)),
    readRows<ReadingRow>(db, readingsQuery(groupId)),
    readRows<NoteDocRow>(db, groupDocumentsQuery(groupId)),
  ]);
  return { entryRows, memberRows, readingRows, documentRows };
};

export type TimelineRows = Awaited<ReturnType<typeof loadTimelineRows>>;
