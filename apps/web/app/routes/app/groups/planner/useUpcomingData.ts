import type { TimelineEntry } from "~/lib/core/rpc";
import type { NoteDocRow } from "~/lib/live-notes/notes.sync";
import type { EntryFilters, EntryRow, MemberRow } from "~/lib/timeline/timeline.sync";
import type { ContactRow, LinkedContact } from "./upcomingContact";
import type { UpcomingSection } from "~/lib/appointments/upcomingDays";
import type { RecipientRow } from "~/lib/medications/medications.sync";
import type { WithTodos } from "~/lib/todos/plannerTodos";
import type { LocalTodo } from "~/lib/todos/todos.sync";
import type { PastRows, UpcomingRows } from "./loadUpcoming";
import type { PastTextRow, RescheduledTargetRow } from "./upcomingQueries";
import type { GroupTagRow, TagRow } from "~/lib/tags/tags.sync";

import { activeTag } from "@caretook/data/schema";
import { useMemo, useState } from "react";
import { useGroupRecordTags, useGroupTags } from "~/components/tags";
import { matchesText, textTokens } from "~/lib/core/textFilter";
import { localTimeZone } from "~/lib/core/format";
import { isLiveEntryKind } from "~/lib/live-notes/liveEntry";
import { nextLimit, PAGE_SIZE, pageWindow } from "~/lib/core/paging";
import { useLiveQuery } from "~/lib/sync";
import { recipientQuery } from "~/lib/medications/medications.sync";
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
import { showsTodos, plannerTodos, withDueTodos } from "~/lib/todos/plannerTodos";
import {
  pastQueries,
  pastTextCondition,
  pastTextQuery,
  rescheduledTargetsQuery,
  upcomingQueries,
} from "./upcomingQueries";

// Upcoming's and the Past tab's data, live: the loaders read the first
// render's rows (`loadUpcoming`, `loadPast`), and live queries here take
// over, so other members' changes appear as they sync, and a clock moves
// items from Upcoming to the Past as their time passes.

/** How often the clock ticks: an item leaves Upcoming within this long of its end. */
export const UPCOMING_TICK_MS = 30_000;

/** An entry, or (in Upcoming only) an open dated todo. */
export type UpcomingListItem = WithTodos<TimelineEntry, LocalTodo>;

export type UpcomingListData = {
  sections: UpcomingSection<UpcomingListItem>[];
  /** A rescheduled event's new one (for "Rescheduled to …"), while it's on the device and not deleted. */
  rescheduledOf: (entry: TimelineEntry) => RescheduledTarget | undefined;
  /** The clock the sections were cut with. */
  now: Date;
  nameOf: (userId: string) => string;
  imageOf: (userId: string) => string | null;
  /** The group's members, for the author filter. */
  members: { userId: string; name: string }[];
  /** An entry's linked providers, in link order, with how to reach them. */
  contactsOf: (entryId: string) => LinkedContact[] | undefined;
  /** The recipient's zone, which todos' due days and times are in (Upcoming only). */
  todoZone?: string;
  /** The group's tags, A to Z (the Filter menu's Tag section). */
  tags: TagRow[];
  /** The tag filter in effect: `?tag=` when the group has it, else null. */
  tag: TagRow | null;
  /** A listed event's or todo's tags, for its chips. */
  tagsOf: (target: "entry" | "todo", id: string) => GroupTagRow[] | undefined;
};

type TagRows = { tagRows: TagRow[]; entryTagRows: GroupTagRow[]; todoTagRows: GroupTagRow[] };

/**
 * The group's tags and each listed record's, live (one query per type),
 * and the filter's tag (`asked`, from `?tag=`) only while the group has
 * it: a deleted tag stops filtering (tags PRD).
 */
function useListTags(groupId: string, initial: TagRows, asked: string | null | undefined) {
  const tags = useGroupTags(groupId, initial.tagRows);
  const entryTags = useGroupRecordTags(groupId, "entry", initial.entryTagRows);
  const todoTags = useGroupRecordTags(groupId, "todo", initial.todoTagRows);
  return {
    tags,
    tag: activeTag(asked ?? null, tags),
    todoTags,
    tagsOf: (target: "entry" | "todo", id: string) => (target === "todo" ? todoTags : entryTags).get(id),
  };
}

/** Where a cancelled event was rescheduled to. */
export type RescheduledTarget = { id: string; occurredAt: string };
/** The group's documents' text, live, by id (a note's or event's document has its entry's id). */
function useDocumentPreviews(groupId: string, initial: NoteDocRow[]) {
  const documentsSql = groupDocumentsQuery(groupId);
  const documentRows = useLiveQuery<NoteDocRow>(documentsSql.sql, documentsSql.params, initial);
  return useMemo(() => toPreviews(documentRows), [documentRows]);
}

/** Members, previews, contacts and reschedules: what both lists need besides their entries. */
function useListSupport(
  groupId: string,
  initial: { memberRows: MemberRow[]; targetRows: RescheduledTargetRow[] },
  contactRows: ContactRow[],
  previews: ReadonlyMap<string, string>,
) {
  const membersSql = membersQuery(groupId);
  const memberRows = useLiveQuery<MemberRow>(membersSql.sql, membersSql.params, initial.memberRows);
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
    members: members.map((m) => ({ userId: m.userId, name: m.name ?? "Former member" })),
    nameOf: (id: string) => members.find((m) => m.userId === id)?.name ?? "Former member",
    imageOf: (id: string) => members.find((m) => m.userId === id)?.image ?? null,
    contactsOf: (id: string) => contacts.get(id),
    rescheduledOf: (entry: TimelineEntry) =>
      entry.rescheduledTo ? targets.get(entry.rescheduledTo) : undefined,
  };
}

/**
 * Everything Upcoming shows, live. `q` (the search box) keeps the entries
 * whose title, place or text and the todos whose title or assignee has every
 * word typed; Upcoming isn't paged, so it filters what it has. `filters.tag`
 * (`?tag=`) narrows events in their queries and todos here, once the group
 * is known to have it.
 */
export function useUpcomingData({
  groupId,
  filters: asked,
  todosOnly = false,
  q = "",
  initial,
}: {
  groupId: string;
  filters: EntryFilters;
  /** Todos only (`?show=todos`): no entries. */
  todosOnly?: boolean;
  q?: string;
  initial: UpcomingRows;
}): UpcomingListData {
  const now = useNow(UPCOMING_TICK_MS);
  const tagging = useListTags(groupId, initial, asked.tag);
  const filters = { ...asked, tag: tagging.tag?.id ?? null };
  const queries = upcomingQueries(groupId, filters, now);
  const entryRows = useLiveQuery<EntryRow>(queries.entries.sql, queries.entries.params, initial.entryRows);
  const contactRows = useLiveQuery<ContactRow>(
    queries.contacts.sql,
    queries.contacts.params,
    initial.contactRows,
  );
  const previews = useDocumentPreviews(groupId, initial.documentRows);
  const support = useListSupport(groupId, initial, contactRows, previews);
  const tokens = textTokens(q);
  // The recipient's zone, which todos' due days and times are in.
  const recipientSql = recipientQuery(groupId);
  const recipient = useLiveQuery<RecipientRow>(recipientSql.sql, recipientSql.params, initial.recipientRows);
  const todoZone = recipient[0]?.time_zone || "UTC";
  const at = new Date(now);
  const zone = localTimeZone();
  const shown = todosOnly
    ? []
    : support
        .withPreview(toTimelineEntries(entryRows))
        .filter((e) => matchesText(tokens, e.title, e.place, e.body));
  const sections = upcomingSections(shown, at, zone);
  // Open dated todos through Upcoming's last day, live: completing one drops it out.
  const dueTodos = useDueTodos(groupId, todoZone, {
    days: UPCOMING_HORIZON_DAYS,
    initial: initial.todoRows,
  });
  const { tag, todoTags } = tagging;
  const matching = dueTodos.todos.filter(
    (t) =>
      (!tag || !!todoTags.get(t.id)?.some((l) => l.id === tag.id)) &&
      matchesText(tokens, t.title, t.assigneeName, t.assigneeId ? support.nameOf(t.assigneeId) : null),
  );
  const todos = showsTodos(filters) ? plannerTodos(matching, at, todoZone) : [];
  return {
    sections: withDueTodos(sections, todos, at, zone, todoZone),
    rescheduledOf: support.rescheduledOf,
    now: at,
    nameOf: support.nameOf,
    imageOf: support.imageOf,
    members: support.members,
    contactsOf: support.contactsOf,
    todoZone,
    tags: tagging.tags,
    tag: tagging.tag,
    tagsOf: tagging.tagsOf,
  };
}

export type PastData = UpcomingListData & {
  hasOlder: boolean;
  loadingOlder: boolean;
  loadOlder: () => void;
};

/**
 * The Past tab's events, live, paged like the timeline: scrolling near the
 * end grows the window by a page, and a new author filter or text starts
 * from one page. `q` (the search box) is matched over every past event's
 * text (`pastTextCondition`), and the matching ids go into the paged local
 * query, so an event older than the loaded page is found too.
 */
export function usePastEvents({
  groupId,
  filters: asked,
  q = "",
  initial,
}: {
  groupId: string;
  filters: EntryFilters;
  q?: string;
  initial: PastRows;
}): PastData {
  const now = useNow(UPCOMING_TICK_MS);
  const tagging = useListTags(groupId, initial, asked.tag);
  const filters = { ...asked, tag: tagging.tag?.id ?? null };
  const { author } = filters;
  const filterKey = `${author ?? ""}\n${filters.tag ?? ""}\n${q.trim()}`;
  const [paging, setPaging] = useState({ filterKey, limit: PAGE_SIZE });
  const requested = paging.filterKey === filterKey ? paging.limit : PAGE_SIZE;

  const previews = useDocumentPreviews(groupId, initial.documentRows);
  const textSql = pastTextQuery(groupId, filters, initial.cutoff);
  const textRows = useLiveQuery<PastTextRow>(textSql.sql, textSql.params, initial.textRows);
  const match = useMemo(() => pastTextCondition(textRows, previews, q), [textRows, previews, q]);

  const queries = pastQueries(groupId, { ...filters, match }, requested, initial.cutoff);
  const entries = useLiveRows<EntryRow>(queries.entries.sql, queries.entries.params, initial.entryRows);
  const contacts = useLiveRows<ContactRow>(
    queries.contacts.sql,
    queries.contacts.params,
    initial.contactRows,
  );
  const support = useListSupport(groupId, initial, contacts.rows, previews);
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
    members: support.members,
    contactsOf: support.contactsOf,
    tags: tagging.tags,
    tag: tagging.tag,
    tagsOf: tagging.tagsOf,
    hasOlder: page.hasOlder,
    loadingOlder: page.loading,
    loadOlder: () => {
      if (page.loading || !page.hasOlder) return;
      setPaging({ filterKey, limit: nextLimit(page.limit) });
    },
  };
}
