import type { TimelineEntry } from "~/lib/rpc";
import type { NoteDocRow } from "~/lib/sync/notes";
import type { EntryFilters, EntryRow, MemberRow } from "~/lib/sync/timeline";
import type { ContactRow, LinkedContact } from "./upcomingContact";
import type { UpcomingSection } from "./upcomingDays";
import type { PastRows, UpcomingRows } from "./loadUpcoming";

import { useMemo, useState } from "react";
import { localTimeZone } from "~/lib/format";
import { isLiveEntryKind } from "~/lib/liveEntry";
import { nextLimit, PAGE_SIZE, pageWindow } from "~/lib/paging";
import { useLiveQuery } from "~/lib/sync";
import { useNow } from "~/lib/sync/editors";
import { groupDocumentsQuery, toPreviews } from "~/lib/sync/notes";
import { fromLocalTimestamp, membersQuery, toMember, toTimelineEntries } from "~/lib/sync/timeline";
import { useLiveRows } from "~/lib/sync/useLiveRows";
import { contactsByEntry } from "./upcomingContact";
import { pastSections, upcomingSections } from "./upcomingDays";
import { pastQueries, upcomingQueries } from "./upcomingQueries";

// Upcoming's and the Past tab's data, live: the loaders read the first
// render's rows (`loadUpcoming`, `loadPast`), and live queries here take
// over, so other members' changes appear as they sync, and a clock moves
// items from Upcoming to the Past as their time passes.

/** How often the clock ticks: an item leaves Upcoming within this long of its end. */
export const UPCOMING_TICK_MS = 30_000;

export type UpcomingListData = {
  sections: UpcomingSection<TimelineEntry>[];
  /** Every listed entry by id (a cancelled one's "Rescheduled to …" looks its new event up here). */
  byId: Map<string, TimelineEntry>;
  /** The clock the sections were cut with. */
  now: Date;
  nameOf: (userId: string) => string;
  imageOf: (userId: string) => string | null;
  /** An entry's linked providers, in link order, with how to reach them. */
  contactsOf: (entryId: string) => LinkedContact[] | undefined;
};

/** Members, previews and contacts: what both lists need besides their entries. */
function useListSupport(
  groupId: string,
  initial: { memberRows: MemberRow[]; documentRows: NoteDocRow[] },
  contactRows: ContactRow[],
) {
  const membersSql = membersQuery(groupId);
  const memberRows = useLiveQuery<MemberRow>(membersSql.sql, membersSql.params, initial.memberRows);
  const documentsSql = groupDocumentsQuery(groupId);
  const documentRows = useLiveQuery<NoteDocRow>(documentsSql.sql, documentsSql.params, initial.documentRows);
  const previews = useMemo(() => toPreviews(documentRows), [documentRows]);
  const contacts = useMemo(() => contactsByEntry(contactRows, fromLocalTimestamp), [contactRows]);
  const members = memberRows.map(toMember);
  return {
    // A note's or event's text is its live document: its preview is the body.
    withPreview: (entries: TimelineEntry[]) =>
      entries.map((entry) =>
        isLiveEntryKind(entry.kind) ? { ...entry, body: previews.get(entry.id) || null } : entry,
      ),
    nameOf: (id: string) => members.find((m) => m.userId === id)?.name ?? "Former member",
    imageOf: (id: string) => members.find((m) => m.userId === id)?.image ?? null,
    contactsOf: (id: string) => contacts.get(id),
  };
}

/** Everything Upcoming shows, live. */
export function useUpcomingData({
  groupId,
  filters,
  initial,
}: {
  groupId: string;
  filters: EntryFilters;
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
  const at = new Date(now);
  const shown = support.withPreview(toTimelineEntries(entryRows));
  return {
    sections: upcomingSections(shown, at, localTimeZone()),
    byId: new Map(shown.map((e) => [e.id, e])),
    now: at,
    nameOf: support.nameOf,
    imageOf: support.imageOf,
    contactsOf: support.contactsOf,
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
    byId: new Map(shown.map((e) => [e.id, e])),
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
