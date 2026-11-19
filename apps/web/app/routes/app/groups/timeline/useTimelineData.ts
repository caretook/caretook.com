import type { EntryProviderLinkRow, LinkedProviderName } from "~/lib/entryProviders";
import type { LiveDocument } from "~/lib/liveNow";
import type { LatestVital, TimelineEntry } from "~/lib/rpc";
import type { NoteDocRow } from "~/lib/sync/notes";
import type { EntryFilters, EntryRow, MemberRow, ReadingRow } from "~/lib/sync/timeline";
import type { TimelineRows } from "./timelineRows";
import type { TimelineDay } from "./timelineDays";
import type { UpcomingSection } from "~/lib/upcomingDays";
import type { PeriodMarker } from "~/lib/periodMarkers";
import type { LocalCarePeriod } from "~/lib/sync/carePeriods";
import type { TimelinePeriods } from "./timelinePeriods";

import { useMemo, useState } from "react";
import { isEntryKind, KIND_META } from "~/lib/entryDisplay";
import { groupLinksByEntry } from "~/lib/entryProviders";
import { localTimeZone } from "~/lib/format";
import { isLiveEntryKind } from "~/lib/liveEntry";
import { liveDotLabel } from "~/lib/liveNow";
import { withMedication } from "~/lib/medicationEntries";
import { useLiveQuery } from "~/lib/sync";
import { useLiveDocuments } from "~/lib/sync/editors";
import { useSchedulePasses } from "~/lib/sync/medicationPasses";
import { useTimelineMedications } from "~/lib/sync/medicationTimeline";
import { groupDocumentsQuery, toPreviews } from "~/lib/sync/notes";
import { timelineLinksQuery } from "~/lib/sync/providers";
import {
  fromLocalTimestamp,
  historyQuery,
  membersQuery,
  readingsQuery,
  toLatestVitals,
  toMember,
  toTimelineEntries,
} from "~/lib/sync/timeline";
import { groupByDay } from "./timelineDays";
import { nextLimit, PAGE_SIZE, pageWindow } from "~/lib/paging";
import { useLiveRows } from "~/lib/sync/useLiveRows";
import { rowPassLogId, wholeLogsPage } from "~/lib/passLogs";
import { nextUp } from "~/lib/upcoming";
import { firstItems, UPCOMING_BLOCK_LIMIT, upcomingSections } from "~/lib/upcomingDays";
import { periodMarkers } from "~/lib/periodMarkers";
import { aheadQueries } from "./aheadQueries";
import { useTimelinePeriods } from "./timelinePeriods";
import { useHistoryCutoff } from "./useHistoryCutoff";

// The timeline's data, live: the loader reads the first screenful
// (`loadTimelineRows`), and live queries here take over from there, so other
// members' changes appear as they sync.

export type TimelineData = {
  /** The loaded entries, grouped by the viewer's day. Notes and events carry their document's preview as `body`. */
  days: TimelineDay<TimelineEntry>[];
  /** There are older entries than the loaded ones; `loadOlder` loads the next page. */
  hasOlder: boolean;
  /** A page is loading (the shown entries stay as they are until it's in). */
  loadingOlder: boolean;
  /** Load the next page, unless one is loading or there's nothing older. */
  loadOlder: () => void;
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
  /** A pass's name (deleted ones too), for a pass log's row; null when it isn't on the device. */
  passNameOf: (passId: string | null) => string | null;
  /** Where the history ends (`historyCutoff`); what's ahead is worked out at this moment. */
  now: Date;
  /** The Next strip: the group's first live item ahead (cancelled ones skipped), and how many more. Ignores the kind and author filters, not the search. */
  next: { next: TimelineEntry | null; more: number };
  /** The Upcoming block (`?upcoming=1`): its first items under the filters, by day, and how many there are in all. */
  upcoming: { sections: UpcomingSection<TimelineEntry>[]; total: number };
  /** The care periods' track and their places' names (the current-period line). Ignores the filters. */
  periods: TimelinePeriods;
  /** The boundary markers in the loaded window, newest first (all older ones once the beginning is loaded). Ignore the filters. */
  markers: PeriodMarker<LocalCarePeriod>[];
};

/** A live document's title: its entry's, else its kind ("Note"). */
const liveTitle = (row: { kind: string; title: string | null }) =>
  row.title?.trim() || (isEntryKind(row.kind) ? KIND_META[row.kind].label : "Entry");

/**
 * Everything the timeline shows, live. Paging is here: scrolling near the end
 * calls `loadOlder`, which grows the local query's limit by a page (it asks
 * for one extra row to know there's more), and a change to any filter (the
 * search included) starts over from one page. While a larger window loads, the previous one
 * stays on screen, entries and "with …" lines alike (`pageWindow`).
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
  // The paging belongs to one set of filters (kind, author and search): under any other, it's one page again.
  const filterKey = JSON.stringify([
    filters.kind,
    filters.author,
    filters.match ?? null,
    filters.vital ?? null,
  ]);
  const [paging, setPaging] = useState({ filterKey, limit: PAGE_SIZE });
  const requested = paging.filterKey === filterKey ? paging.limit : PAGE_SIZE;

  // The history ends at a cutoff that moves on once a minute, so items cross
  // from the Upcoming block and the Next strip into it without new rows.
  const cutoff = useHistoryCutoff(initial.cutoff);
  const entriesSql = historyQuery(groupId, filters, requested, cutoff);
  const entries = useLiveRows<EntryRow>(entriesSql.sql, entriesSql.params, initial.entryRows);
  const membersSql = membersQuery(groupId);
  const memberRows = useLiveQuery<MemberRow>(membersSql.sql, membersSql.params, initial.memberRows);
  const readingsSql = readingsQuery(groupId);
  const readingRows = useLiveQuery<ReadingRow>(readingsSql.sql, readingsSql.params, initial.readingRows);
  // Previews are rebuilt locally from the documents, so they include unsynced edits.
  const documentsSql = groupDocumentsQuery(groupId);
  const documentRows = useLiveQuery<NoteDocRow>(documentsSql.sql, documentsSql.params, initial.documentRows);
  const previews = useMemo(() => toPreviews(documentRows), [documentRows]);
  // One query for every loaded entry's links (the same window as the entries), never one per row.
  const linksSql = timelineLinksQuery(groupId, filters, requested, cutoff);
  const links = useLiveRows<EntryProviderLinkRow>(linksSql.sql, linksSql.params, initial.linkRows);
  const linkRows = links.rows;
  // What's ahead of the history: the Next strip's rows and the Upcoming block's, with its links.
  const ahead = aheadQueries(groupId, filters, cutoff);
  const nextRows = useLiveQuery<EntryRow>(ahead.next.sql, ahead.next.params, initial.nextRows);
  const blockRows = useLiveQuery<EntryRow>(ahead.block.sql, ahead.block.params, initial.blockRows);
  const blockLinkRows = useLiveQuery<EntryProviderLinkRow>(
    ahead.blockLinks.sql,
    ahead.blockLinks.params,
    initial.blockLinkRows,
  );
  const providersByEntry = useMemo(() => groupLinksByEntry(linkRows, fromLocalTimestamp), [linkRows]);
  // An item in progress is in both lists: either query has its links.
  const blockProviders = useMemo(() => groupLinksByEntry(blockLinkRows, fromLocalTimestamp), [blockLinkRows]);
  // The new page shows once both windows are in, so no "with …" line flickers.
  const page = pageWindow({
    rowCount: entries.rows.length,
    requested,
    fresh: entries.fresh && links.fresh,
  });
  // Doses and medication changes are named by their medication: one query over the same window.
  const medicationOf = useTimelineMedications(groupId, filters, requested, cutoff);
  // A schedule change names the passes it touched.
  const passes = useSchedulePasses(groupId);

  const members = memberRows.map(toMember);
  const nameOf = (id: string) => members.find((m) => m.userId === id)?.name ?? "Former member";

  const liveDocuments = useLiveDocuments(groupId, userId, liveTitle);
  const liveLabels = new Map(
    liveDocuments.map((d) => [d.id, liveDotLabel(d.editors.map((e) => nameOf(e.userId)))]),
  );

  // A note's or event's text is its live document: its preview is the body.
  const withPreview = (rows: EntryRow[]) =>
    toTimelineEntries(rows).map((entry) =>
      isLiveEntryKind(entry.kind)
        ? { ...entry, body: previews.get(entry.id) || null }
        : withMedication(entry, medicationOf, passes),
    );
  // A pass log is never split across pages: one running past the page waits for the next.
  const shown = withPreview(wholeLogsPage(entries.rows, page.limit, rowPassLogId));
  // The track, and its markers over the same window as the shown entries.
  const periods = useTimelinePeriods(groupId, initial);
  const markers = periodMarkers(periods.spans, {
    oldestLoaded: shown.at(-1)?.occurredAt ?? null,
    hasOlder: page.hasOlder,
    filtered: !!(filters.kind || filters.author || filters.match),
  });
  const now = new Date(cutoff);
  const zone = localTimeZone();

  return {
    days: groupByDay(shown, zone, new Date()),
    hasOlder: page.hasOlder,
    loadingOlder: page.loading,
    loadOlder: () => {
      if (page.loading || !page.hasOlder) return;
      setPaging({ filterKey, limit: nextLimit(page.limit) });
    },
    latestVitals: toLatestVitals(readingRows),
    liveDocuments,
    liveLabelOf: (id) => liveLabels.get(id),
    nameOf,
    imageOf: (id) => members.find((m) => m.userId === id)?.image ?? null,
    providersOf: (id) => providersByEntry.get(id) ?? blockProviders.get(id),
    passNameOf: (id) => (id ? (passes.find((p) => p.id === id)?.name ?? null) : null),
    now,
    next: nextUp(toTimelineEntries(nextRows), now),
    upcoming: firstItems(upcomingSections(withPreview(blockRows), now, zone), UPCOMING_BLOCK_LIMIT),
    periods,
    markers,
  };
}
