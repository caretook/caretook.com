import type { SyncDb } from "~/lib/sync";
import type { NoteDocRow } from "~/lib/sync/notes";
import type { EntryFilters, EntryRow, MemberRow } from "~/lib/sync/timeline";
import type { ContactRow } from "./upcomingContact";
import type { RescheduledTargetRow } from "./upcomingQueries";
import type { TaskRow } from "~/lib/sync/tasks";

import { PAGE_SIZE } from "~/lib/paging";
import { loadDueDoses } from "~/lib/sync/dueDoses";
import { groupDocumentsQuery } from "~/lib/sync/notes";
import { dueTasksQuery, dueTasksThrough } from "~/lib/sync/tasks";
import { membersQuery, readRows, UPCOMING_HORIZON_DAYS } from "~/lib/sync/timeline";
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

/** Upcoming's rows at `now`, with what today's due doses and the due tasks are worked out from. */
export const loadUpcoming = async (db: SyncDb, groupId: string, filters: EntryFilters, now = new Date()) => {
  const queries = upcomingQueries(groupId, filters, now);
  const [entryRows, contactRows, [memberRows, documentRows, targetRows], dueRows] = await Promise.all([
    readRows<EntryRow>(db, queries.entries),
    readRows<ContactRow>(db, queries.contacts),
    shared(db, groupId),
    loadDueDoses(db, groupId),
  ]);
  // Open dated tasks through Upcoming's last day, in the recipient's zone (`useDueTasks`'s first rows).
  const zone = dueRows.recipient[0]?.time_zone || "UTC";
  const through = dueTasksThrough(now, zone, UPCOMING_HORIZON_DAYS);
  const taskRows = await readRows<TaskRow>(db, dueTasksQuery(groupId, null, through));
  return { entryRows, contactRows, memberRows, documentRows, targetRows, dueRows, taskRows };
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
