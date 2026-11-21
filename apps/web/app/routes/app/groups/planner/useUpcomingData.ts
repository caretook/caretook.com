import type { TimelineEntry } from "~/lib/core/rpc";
import type { NoteDocRow } from "~/lib/live-notes/notes.sync";
import type { EntryFilters, EntryRow, MemberRow } from "~/lib/timeline/timeline.sync";
import type { ContactRow, LinkedContact } from "./upcomingContact";
import type { UpcomingSection } from "~/lib/appointments/upcomingDays";
import type { WithDoses } from "~/lib/appointments/upcomingDoses";
import type { WithTodos } from "~/lib/todos/plannerTodos";
import type { LocalTodo } from "~/lib/todos/todos.sync";
import type { PastRows, UpcomingRows } from "./loadUpcoming";
import type { RescheduledTargetRow } from "./upcomingQueries";

import { useMemo, useState } from "react";
import { localTimeZone } from "~/lib/core/format";
import { isLiveEntryKind } from "~/lib/live-notes/liveEntry";
import { nextLimit, PAGE_SIZE, pageWindow } from "~/lib/core/paging";
import { useLiveQuery } from "~/lib/sync";
import { useDueDoses } from "~/lib/medications/dueDoses.sync";
import { useNow } from "~/lib/live-notes/editors.sync";
import { useDueTodos } from "~/lib/todos/todos.sync";
import { groupDocumentsQuery, toPreviews } from "~/lib/live-notes/notes.sync";
import {
  fromLocalTimestamp,
  membersQuery,
  toMember,
  toTimelineEntries,
  UPCOMING_HORIZON_DAYS,
} from "~/lib/timeline/timeline.sync";
import { useLiveRows } from "~/lib/sync/useLiveRows";
import { contactsByEntry } from "./upcomingContact";
import { pastSections, upcomingSections } from "~/lib/appointments/upcomingDays";
import { showsDoses, upcomingDoses, withDueDoses } from "~/lib/appointments/upcomingDoses";
import { showsTodos, plannerTodos, withDueTodos } from "~/lib/todos/plannerTodos";
import { pastQueries, rescheduledTargetsQuery, upcomingQueries } from "./upcomingQueries";

// Upcoming's and the Past tab's data, live: the loaders read the first
// render's rows (`loadUpcoming`, `loadPast`), and live queries here take
// over, so other members' changes appear as they sync, and a clock moves
// items from Upcoming to the Past as their time passes.

/** How often the clock ticks: an item leaves Upcoming within this long of its end. */
export const UPCOMING_TICK_MS = 30_000;

/** An entry, or (in Upcoming only) one of today's open dose slots or an open dated todo. */
export type UpcomingListItem = WithTodos<WithDoses<TimelineEntry>, LocalTodo>;

export type UpcomingListData = {
  sections: UpcomingSection<UpcomingListItem>[];
  /** A rescheduled event's new one (for "Rescheduled to …"), while it's on the device and not deleted. */
  rescheduledOf: (entry: TimelineEntry) => RescheduledTarget | undefined;
  /** The clock the sections were cut with. */
  now: Date;
  nameOf: (userId: string) => string;
  imageOf: (userId: string) => string | null;
  /** An entry's linked providers, in link order, with how to reach them. */
  contactsOf: (entryId: string) => LinkedContact[] | undefined;
  /** The recipient's zone, which todos' due days and times are in (Upcoming only). */
  todoZone?: string;
};

/** Where a cancelled event was rescheduled to. */
export type RescheduledTarget = { id: string; occurredAt: string };
/** Members, previews, contacts and reschedules: what both lists need besides their entries. */
function useListSupport(
  groupId: string,
  initial: { memberRows: MemberRow[]; documentRows: NoteDocRow[]; targetRows: RescheduledTargetRow[] },
  contactRows: ContactRow[],
) {
  const membersSql = membersQuery(groupId);
  const memberRows = useLiveQuery<MemberRow>(membersSql.sql, membersSql.params, initial.memberRows);
  const documentsSql = groupDocumentsQuery(groupId);
  const documentRows = useLiveQuery<NoteDocRow>(documentsSql.sql, documentsSql.params, initial.documentRows);
  const previews = useMemo(() => toPreviews(documentRows), [documentRows]);
  const contacts = useMemo(() => contactsByEntry(contactRows, fromLocalTimestamp), [contactRows]);
  const members = memberRows.map(toMember);
  const targetsSql = rescheduledTargetsQuery(groupId);
  const targetRows = useLiveQuery<RescheduledTargetRow>(
    targetsSql.sql,
    targetsSql.params,
    initial.targetRows,
  );
  const targets = useMemo(
    () =>
      new Map(
        targetRows.flatMap((row) =>
          row.occurred_at
            ? [[row.id, { id: row.id, occurredAt: fromLocalTimestamp(row.occurred_at) }] as const]
            : [],
        ),
      ),
    [targetRows],
  );
  return {
    // A note's or event's text is its live document: its preview is the body.
    withPreview: (entries: TimelineEntry[]) =>
      entries.map((entry) =>
        isLiveEntryKind(entry.kind) ? { ...entry, body: previews.get(entry.id) || null } : entry,
      ),
    nameOf: (id: string) => members.find((m) => m.userId === id)?.name ?? "Former member",
    imageOf: (id: string) => members.find((m) => m.userId === id)?.image ?? null,
    contactsOf: (id: string) => contacts.get(id),
    rescheduledOf: (entry: TimelineEntry) =>
      entry.rescheduledTo ? targets.get(entry.rescheduledTo) : undefined,
  };
}

/** Everything Upcoming shows, live. */
export function useUpcomingData({
  groupId,
  filters,
  todosOnly = false,
  initial,
}: {
  groupId: string;
  filters: EntryFilters;
  /** Todos only (`?show=todos`): no entries and no due doses. */
  todosOnly?: boolean;
  initial: UpcomingRows;
}): UpcomingListData {
  const now = useNow(UPCOMING_TICK_MS);
  const queries = upcomingQueries(groupId, filters, now);
  const entryRows = useLiveQuery<EntryRow>(queries.entries.sql, queries.entries.params, initial.entryRows);
  const contactRows = useLiveQuery<ContactRow>(
    queries.contacts.sql,
    queries.contacts.params,
    initial.contactRows,
  );
  const support = useListSupport(groupId, initial, contactRows);
  // Today's open dose slots, live: a logged dose answers its slot, and it drops out.
  const dueDoses = useDueDoses(groupId, initial.dueRows);
  const at = new Date(now);
  const zone = localTimeZone();
  const shown = todosOnly ? [] : support.withPreview(toTimelineEntries(entryRows));
  const sections = upcomingSections(shown, at, zone);
  const doses = showsDoses(filters) && !todosOnly ? upcomingDoses(dueDoses.due, dueDoses.passes) : [];
  // Open dated todos through Upcoming's last day, live: completing one drops it out.
  const dueTodos = useDueTodos(groupId, dueDoses.timeZone, {
    days: UPCOMING_HORIZON_DAYS,
    initial: initial.todoRows,
  });
  const todos = showsTodos(filters) ? plannerTodos(dueTodos.todos, at, dueDoses.timeZone) : [];
  return {
    sections: withDueTodos(withDueDoses(sections, doses, at, zone), todos, at, zone, dueDoses.timeZone),
    rescheduledOf: support.rescheduledOf,
    now: at,
    nameOf: support.nameOf,
    imageOf: support.imageOf,
    contactsOf: support.contactsOf,
    todoZone: dueDoses.timeZone,
  };
}

export type PastData = UpcomingListData & {
  hasOlder: boolean;
  loadingOlder: boolean;
  loadOlder: () => void;
};

/**
 * The Past tab's events, live, paged like the timeline: scrolling near the
 * end grows the window by a page, and a new author filter starts from one page.
 */
export function usePastEvents({
  groupId,
  filters,
  initial,
}: {
  groupId: string;
  filters: EntryFilters;
  initial: PastRows;
}): PastData {
  const now = useNow(UPCOMING_TICK_MS);
  const { author } = filters;
  const [paging, setPaging] = useState({ author, limit: PAGE_SIZE });
  const requested = paging.author === author ? paging.limit : PAGE_SIZE;

  const queries = pastQueries(groupId, filters, requested, initial.cutoff);
  const entries = useLiveRows<EntryRow>(queries.entries.sql, queries.entries.params, initial.entryRows);
  const contacts = useLiveRows<ContactRow>(
    queries.contacts.sql,
    queries.contacts.params,
    initial.contactRows,
  );
  const support = useListSupport(groupId, initial, contacts.rows);
  const page = pageWindow({
    rowCount: entries.rows.length,
    requested,
    fresh: entries.fresh && contacts.fresh,
  });

  const at = new Date(now);
  const shown = support.withPreview(toTimelineEntries(entries.rows.slice(0, page.limit)));
  return {
    sections: pastSections(shown, at, localTimeZone()),
    rescheduledOf: support.rescheduledOf,
    now: at,
    nameOf: support.nameOf,
    imageOf: support.imageOf,
    contactsOf: support.contactsOf,
    hasOlder: page.hasOlder,
    loadingOlder: page.loading,
    loadOlder: () => {
      if (page.loading || !page.hasOlder) return;
      setPaging({ author, limit: nextLimit(page.limit) });
    },
  };
}
