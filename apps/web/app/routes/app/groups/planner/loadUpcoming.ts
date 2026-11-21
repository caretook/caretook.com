import type { SyncDb } from "~/lib/sync";
import type { NoteDocRow } from "~/lib/live-notes/notes.sync";
import type { EntryFilters, EntryRow, MemberRow } from "~/lib/timeline/timeline.sync";
import type { ContactRow } from "./upcomingContact";
import type { RescheduledTargetRow } from "./upcomingQueries";
import type { TodoRow } from "~/lib/todos/todos.sync";

import { PAGE_SIZE } from "~/lib/core/paging";
import { loadDueDoses } from "~/lib/medications/dueDoses.sync";
import { groupDocumentsQuery } from "~/lib/live-notes/notes.sync";
import { dueTodosQuery, dueTodosThrough } from "~/lib/todos/todos.sync";
import { membersQuery, readRows, UPCOMING_HORIZON_DAYS } from "~/lib/timeline/timeline.sync";
import { historyCutoff } from "~/lib/appointments/upcoming";
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

/** The Planner tab's rows at `now`, with what today's due doses and the due todos are worked out from. */
export const loadUpcoming = async (db: SyncDb, groupId: string, filters: EntryFilters, now = new Date()) => {
  const queries = upcomingQueries(groupId, filters, now);
  const [entryRows, contactRows, [memberRows, documentRows, targetRows], dueRows] = await Promise.all([
    readRows<EntryRow>(db, queries.entries),
    readRows<ContactRow>(db, queries.contacts),
    shared(db, groupId),
    loadDueDoses(db, groupId),
  ]);
  // Open dated todos through Upcoming's last day, in the recipient's zone (`useDueTodos`'s first rows).
  const zone = dueRows.recipient[0]?.time_zone || "UTC";
  const through = dueTodosThrough(now, zone, UPCOMING_HORIZON_DAYS);
  const todoRows = await readRows<TodoRow>(db, dueTodosQuery(groupId, null, through));
  return { entryRows, contactRows, memberRows, documentRows, targetRows, dueRows, todoRows };
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
