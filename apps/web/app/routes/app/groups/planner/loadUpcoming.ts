import type { SyncDb } from "~/lib/sync";
import type { NoteDocRow } from "~/lib/live-notes/notes.sync";
import type { EntryFilters, EntryRow, LocalQuery, MemberRow } from "~/lib/timeline/timeline.sync";
import type { ContactRow } from "./upcomingContact";
import type { PastTextRow, RescheduledTargetRow } from "./upcomingQueries";
import type { SubtaskProgressRow, TodoRow } from "~/lib/todos/todos.sync";
import type { GroupTagRow, TagRow } from "~/lib/tags/tags.sync";

import { activeTag } from "@caretook/data/schema";
import { PAGE_SIZE } from "~/lib/core/paging";
import { groupRecordTagsQuery, tagsQuery } from "~/lib/tags/tags.sync";
import { recipientQuery } from "~/lib/medications/medications.sync";
import type { RecipientRow } from "~/lib/medications/medications.sync";
import { toPreviews } from "~/lib/live-notes/notes.sync";
import { dueTodosQuery, dueTodosThrough, subtaskProgressQuery } from "~/lib/todos/todos.sync";
import { membersQuery, readRows, UPCOMING_HORIZON_DAYS } from "~/lib/timeline/timeline.sync";
import { historyCutoff } from "~/lib/appointments/upcoming";
import {
  pastDocumentsQuery,
  pastQueries,
  pastTextCondition,
  pastTextQuery,
  rescheduledTargetsQuery,
  upcomingQueries,
} from "./upcomingQueries";

// The first render's rows for Upcoming and its Past tab, read from the
// device's local copy by the routes' loaders; the hooks (`useUpcomingData`,
// `usePastEvents`) take over with live queries over the same rows.

/** What both lists read besides their entries; `documents` is the list's own (only its entries' documents). */
const shared = (db: SyncDb, groupId: string, documents: LocalQuery) =>
  Promise.all([
    readRows<MemberRow>(db, membersQuery(groupId)),
    readRows<NoteDocRow>(db, documents),
    readRows<RescheduledTargetRow>(db, rescheduledTargetsQuery(groupId)),
    readRows<GroupTagRow>(db, groupRecordTagsQuery(groupId, "entry")),
  ]);

/**
 * The group's tags, and `filters` with the tag one only if the group has it
 * (an unknown or deleted tag is no filter; tags PRD). The screens check it
 * the same way against the live tags.
 */
const withTag = async (db: SyncDb, groupId: string, filters: EntryFilters) => {
  const tagRows = await readRows<TagRow>(db, tagsQuery(groupId));
  return { tagRows, filters: { ...filters, tag: activeTag(filters.tag ?? null, tagRows)?.id ?? null } };
};

/** The Planner tab's rows at `now`, with the recipient (whose zone the due todos are worked out in). */
export const loadUpcoming = async (db: SyncDb, groupId: string, asked: EntryFilters, now = new Date()) => {
  const { tagRows, filters } = await withTag(db, groupId, asked);
  const queries = upcomingQueries(groupId, filters, now);
  const [
    entryRows,
    contactRows,
    [memberRows, documentRows, targetRows, entryTagRows],
    recipientRows,
    todoTagRows,
    progressRows,
  ] = await Promise.all([
    readRows<EntryRow>(db, queries.entries),
    readRows<ContactRow>(db, queries.contacts),
    shared(db, groupId, queries.documents),
    readRows<RecipientRow>(db, recipientQuery(groupId)),
    readRows<GroupTagRow>(db, groupRecordTagsQuery(groupId, "todo")),
    // Parents' "n of m done" and subtasks' "Part of" (todo-subtasks-2): one query for the list.
    readRows<SubtaskProgressRow>(db, subtaskProgressQuery(groupId)),
  ]);
  // Open dated todos through Upcoming's last day, in the recipient's zone (`useDueTodos`'s first rows).
  const zone = recipientRows[0]?.time_zone || "UTC";
  const through = dueTodosThrough(now, zone, UPCOMING_HORIZON_DAYS);
  const todoRows = await readRows<TodoRow>(db, dueTodosQuery(groupId, null, through));
  return {
    entryRows,
    contactRows,
    memberRows,
    documentRows,
    targetRows,
    recipientRows,
    todoRows,
    progressRows,
    tagRows,
    entryTagRows,
    todoTagRows,
  };
};

export type UpcomingRows = Awaited<ReturnType<typeof loadUpcoming>>;

/**
 * The Past tab's first page. Its `cutoff` (where the past ends) is fixed
 * for the visit, so a growing page never waits on a moving query; an event
 * that starts while you look shows on the next visit. With the search box's
 * text `q`, only the matching events (`pastTextCondition`).
 */
export const loadPast = async (
  db: SyncDb,
  groupId: string,
  asked: EntryFilters,
  q = "",
  now = new Date(),
) => {
  const cutoff = historyCutoff(now);
  const { tagRows, filters } = await withTag(db, groupId, asked);
  const [textRows, [memberRows, documentRows, targetRows, entryTagRows]] = await Promise.all([
    readRows<PastTextRow>(db, pastTextQuery(groupId, filters, cutoff)),
    shared(db, groupId, pastDocumentsQuery(groupId, filters, cutoff)),
  ]);
  const match = pastTextCondition(textRows, toPreviews(documentRows), q);
  const queries = pastQueries(groupId, { ...filters, match }, PAGE_SIZE, cutoff);
  const [entryRows, contactRows] = await Promise.all([
    readRows<EntryRow>(db, queries.entries),
    readRows<ContactRow>(db, queries.contacts),
  ]);
  return {
    cutoff,
    textRows,
    entryRows,
    contactRows,
    memberRows,
    documentRows,
    targetRows,
    tagRows,
    entryTagRows,
    todoTagRows: [] as GroupTagRow[],
  };
};

export type PastRows = Awaited<ReturnType<typeof loadPast>>;
