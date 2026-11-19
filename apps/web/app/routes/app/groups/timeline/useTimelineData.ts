import type { EntryProviderLinkRow, LinkedProviderName } from "~/lib/entryProviders";
import type { LiveDocument } from "~/lib/liveNow";
import type { LatestVital, TimelineEntry } from "~/lib/rpc";
import type { NoteDocRow } from "~/lib/sync/notes";
import type { EntryFilters, EntryRow, MemberRow, ReadingRow } from "~/lib/sync/timeline";
import type { TimelineRows } from "./timelineRows";
import type { TimelineDay } from "./timelineDays";

import { useMemo, useState } from "react";
import { isEntryKind, KIND_META } from "~/lib/entryDisplay";
import { groupLinksByEntry } from "~/lib/entryProviders";
import { localTimeZone } from "~/lib/format";
import { isLiveEntryKind } from "~/lib/liveEntry";
import { liveDotLabel } from "~/lib/liveNow";
import { withMedication } from "~/lib/medicationEntries";
import { useLiveQuery } from "~/lib/sync";
import { useLiveDocuments } from "~/lib/sync/editors";
import { useTimelineMedications } from "~/lib/sync/medicationTimeline";
import { groupDocumentsQuery, toPreviews } from "~/lib/sync/notes";
import { timelineLinksQuery } from "~/lib/sync/providers";
import {
  entriesQuery,
  fromLocalTimestamp,
  membersQuery,
  readingsQuery,
  toLatestVitals,
  toMember,
  toTimelineEntries,
} from "~/lib/sync/timeline";
import { groupByDay } from "./timelineDays";
import { PAGE_SIZE } from "./timelineRows";

// The timeline's data, live: the loader reads the first screenful
// (`loadTimelineRows`), and live queries here take over from there, so other
// members' changes appear as they sync.

export type TimelineData = {
  /** The loaded entries, grouped by the viewer's day. Notes and events carry their document's preview as `body`. */
  days: TimelineDay<TimelineEntry>[];
  /** There are older entries than the loaded ones; `showOlder` loads the next page. */
  hasOlder: boolean;
  showOlder: () => void;
  /** Each vital type's newest reading (ignores the filters). */
  latestVitals: LatestVital[];
  /** Notes and events other members are writing in now, most recent first (the Live now banner). */
  liveDocuments: LiveDocument[];
  /** An entry's live dot label, when others are writing in it now. */
  liveLabelOf: (entryId: string) => string | undefined;
  /** A member's name, or "Former member". */
  nameOf: (userId: string) => string;
  /** A member's picture, when they have one (and are still a member). */
  imageOf: (userId: string) => string | null;
  /** A note's or event's linked providers, in link order (the "with …" line). */
  providersOf: (entryId: string) => LinkedProviderName[] | undefined;
};

/** A live document's title: its entry's, else its kind ("Note"). */
const liveTitle = (row: { kind: string; title: string | null }) =>
  row.title?.trim() || (isEntryKind(row.kind) ? KIND_META[row.kind].label : "Entry");

/**
 * Everything the timeline shows, live. Paging is here: "Show older" grows the
 * local query's limit (it asks for one extra row to know there's more), and
 * a change to either filter starts over from one page.
 */
export function useTimelineData({
  groupId,
  userId,
  filters,
  initial,
}: {
  groupId: string;
  userId: string;
  filters: EntryFilters;
  initial: TimelineRows;
}): TimelineData {
  // The paging belongs to one pair of filters: under any other, it's one page again.
  const { kind, author } = filters;
  const [paging, setPaging] = useState({ kind, author, limit: PAGE_SIZE });
  const limit = paging.kind === kind && paging.author === author ? paging.limit : PAGE_SIZE;

  const entriesSql = entriesQuery(groupId, filters, limit);
  const entryRows = useLiveQuery<EntryRow>(entriesSql.sql, entriesSql.params, initial.entryRows);
  const membersSql = membersQuery(groupId);
  const memberRows = useLiveQuery<MemberRow>(membersSql.sql, membersSql.params, initial.memberRows);
  const readingsSql = readingsQuery(groupId);
  const readingRows = useLiveQuery<ReadingRow>(readingsSql.sql, readingsSql.params, initial.readingRows);
  // Previews are rebuilt locally from the documents, so they include unsynced edits.
  const documentsSql = groupDocumentsQuery(groupId);
  const documentRows = useLiveQuery<NoteDocRow>(documentsSql.sql, documentsSql.params, initial.documentRows);
  const previews = useMemo(() => toPreviews(documentRows), [documentRows]);
  // One query for every loaded entry's links (the same window as the entries), never one per row.
  const linksSql = timelineLinksQuery(groupId, filters, limit);
  const linkRows = useLiveQuery<EntryProviderLinkRow>(linksSql.sql, linksSql.params, initial.linkRows);
  const providersByEntry = useMemo(() => groupLinksByEntry(linkRows, fromLocalTimestamp), [linkRows]);
  // Doses and medication changes are named by their medication: one query over the same window.
  const medicationOf = useTimelineMedications(groupId, filters, limit);

  const members = memberRows.map(toMember);
  const nameOf = (id: string) => members.find((m) => m.userId === id)?.name ?? "Former member";

  const liveDocuments = useLiveDocuments(groupId, userId, liveTitle);
  const liveLabels = new Map(
    liveDocuments.map((d) => [d.id, liveDotLabel(d.editors.map((e) => nameOf(e.userId)))]),
  );

  // A note's or event's text is its live document: its preview is the body.
  const entries = toTimelineEntries(entryRows.slice(0, limit)).map((entry) =>
    isLiveEntryKind(entry.kind)
      ? { ...entry, body: previews.get(entry.id) || null }
      : withMedication(entry, medicationOf),
  );

  return {
    days: groupByDay(entries, localTimeZone(), new Date()),
    hasOlder: entryRows.length > limit,
    showOlder: () => setPaging({ kind, author, limit: limit + PAGE_SIZE }),
    latestVitals: toLatestVitals(readingRows),
    liveDocuments,
    liveLabelOf: (id) => liveLabels.get(id),
    nameOf,
    imageOf: (id) => members.find((m) => m.userId === id)?.image ?? null,
    providersOf: (id) => providersByEntry.get(id),
  };
}
