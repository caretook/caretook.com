import type { SyncDb } from "~/lib/sync";
import type { NoteDocRow } from "~/lib/sync/notes";
import type { EntryFilters, EntryRow, MemberRow } from "~/lib/sync/timeline";
import type { ContactRow } from "./upcomingContact";
import type { RescheduledTargetRow } from "./upcomingQueries";

import { PAGE_SIZE } from "~/lib/paging";
import { loadDueDoses } from "~/lib/sync/dueDoses";
import { groupDocumentsQuery } from "~/lib/sync/notes";
import { membersQuery, readRows } from "~/lib/sync/timeline";
import { historyCutoff } from "~/lib/upcoming";
import { pastQueries, rescheduledTargetsQuery, upcomingQueries } from "./upcomingQueries";

// The first render's rows for Upcoming and its Past tab, read from the
// device's local copy by the routes' loaders; the hooks (`useUpcomingData`,
// `usePastEvents`) take over with live queries over the same rows.

const shared = (db: SyncDb, groupId: string) =>
  Promise.all([
    readRows<MemberRow>(db, membersQuery(groupId)),
    readRows<NoteDocRow>(db, groupDocumentsQuery(groupId)),
    readRows<RescheduledTargetRow>(db, rescheduledTargetsQuery(groupId)),
  ]);

/** Upcoming's rows at `now`, with what today's due doses are worked out from. */
export const loadUpcoming = async (db: SyncDb, groupId: string, filters: EntryFilters, now = new Date()) => {
  const queries = upcomingQueries(groupId, filters, now);
  const [entryRows, contactRows, [memberRows, documentRows, targetRows], dueRows] = await Promise.all([
    readRows<EntryRow>(db, queries.entries),
    readRows<ContactRow>(db, queries.contacts),
    shared(db, groupId),
    loadDueDoses(db, groupId),
  ]);
  return { entryRows, contactRows, memberRows, documentRows, targetRows, dueRows };
};

export type UpcomingRows = Awaited<ReturnType<typeof loadUpcoming>>;

/**
 * The Past tab's first page. Its `cutoff` (where the past ends) is fixed
 * for the visit, so a growing page never waits on a moving query; an event
 * that starts while you look shows on the next visit.
 */
export const loadPast = async (db: SyncDb, groupId: string, filters: EntryFilters, now = new Date()) => {
  const cutoff = historyCutoff(now);
  const queries = pastQueries(groupId, filters, PAGE_SIZE, cutoff);
  const [entryRows, contactRows, [memberRows, documentRows, targetRows]] = await Promise.all([
    readRows<EntryRow>(db, queries.entries),
    readRows<ContactRow>(db, queries.contacts),
    shared(db, groupId),
  ]);
  return { cutoff, entryRows, contactRows, memberRows, documentRows, targetRows };
};

export type PastRows = Awaited<ReturnType<typeof loadPast>>;
