import type { EntryProviderLinkRow, LinkedProviderName } from "~/lib/providers/entryProviders";
import type { LiveDocument } from "~/lib/live-notes/liveNow";
import type { LatestVital, TimelineEntry } from "~/lib/core/rpc";
import type { EntryMedicationRow } from "~/lib/medications/medicationTimeline.sync";
import type { NoteDocRow } from "~/lib/live-notes/notes.sync";
import type { EntryFilters, EntryRow, MemberRow, ReadingRow } from "~/lib/timeline/timeline.sync";
import type { TimelineRows } from "./timelineRows";
import type { TimelineDay } from "./timelineDays";
import type { PeriodMarker } from "~/lib/care-periods/periodMarkers";
import type { LocalCarePeriod } from "~/lib/care-periods/carePeriods.sync";
import type { TimelinePeriods } from "./timelinePeriods";

import { useEffect, useMemo, useRef, useState } from "react";
import { NavigationType, useLocation, useNavigationType } from "react-router";
import { isEntryKind, KIND_META } from "~/lib/timeline/entryDisplay";
import { groupLinksByEntry } from "~/lib/providers/entryProviders";
import { localTimeZone } from "~/lib/core/format";
import { isLiveEntryKind } from "~/lib/live-notes/liveEntry";
import { liveDotLabel } from "~/lib/live-notes/liveNow";
import { withMedication } from "~/lib/medications/medicationEntries";
import { getSync, useLiveQuery } from "~/lib/sync";
import { useLiveDocuments } from "~/lib/live-notes/editors.sync";
import { useSchedulePasses } from "~/lib/medications/medicationPasses.sync";
import { useTimelineMedications } from "~/lib/medications/medicationTimeline.sync";
import { groupDocumentsQuery, toPreviews } from "~/lib/live-notes/notes.sync";
import { timelineLinksQuery } from "~/lib/providers/providers.sync";
import {
  fromLocalTimestamp,
  historyQuery,
  membersQuery,
  readingsQuery,
  toLatestVitals,
  toMember,
  toTimelineEntries,
} from "~/lib/timeline/timeline.sync";
import { groupByDay } from "./timelineDays";
import { nextLimit, PAGE_SIZE, pageWindow } from "~/lib/core/paging";
import { useLiveRows } from "~/lib/sync/useLiveRows";
import { rowPassLogId, wholeLogsPage } from "~/lib/medications/passLogs";
import { nextUp } from "~/lib/appointments/upcoming";
import { periodMarkers } from "~/lib/care-periods/periodMarkers";
import { aheadQueries } from "./aheadQueries";
import { useTimelinePeriods } from "./timelinePeriods";
import { useHistoryCutoff } from "./useHistoryCutoff";
import { daySummaryQuery, summariesOff, summarySince } from "./daySummaryRows";
import { keepPaging, startPaging, wasKept } from "./timelinePaging";
import { isJumpState, jumpNotice } from "~/lib/timeline/timelineJump";
import { readNewerWindow } from "~/lib/timeline/timelineNewer.sync";

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
  /** The Today card's appointment: the group's first live item ahead (cancelled ones skipped), and how many more. Ignores the kind and author filters, not the search. */
  next: { next: TimelineEntry | null; more: number };
  /** The care periods' track and their places' names (the current-period line). Ignores the filters. */
  periods: TimelinePeriods;
  /** The boundary markers in the loaded window, newest first (all older ones once the beginning is loaded). Ignore the filters. */
  markers: PeriodMarker<LocalCarePeriod>[];
  /** The day summaries' entries: the loaded days, whole, and the 7 days before them; null while a filter or search is on. */
  summaryEntries: TimelineEntry[] | null;
  /** This mount started from a kept window, rows and all (Back to it: `timelinePaging.ts`). */
  restored: boolean;
  /** This mount came back to a history entry the timeline has already been on (even at one page). */
  returning: boolean;
  /** The day jumped to (`?day=`): whether its window stops short of today, and what the list says about it. */
  jump: {
    day: string;
    /** The rows on screen stop short of today. */
    bounded: boolean;
    /** The bound of the rows on screen (null: the ordinary history). */
    before: string | null;
    notice: string | null;
    /** The day the notice sits above: the nearest on or before the chosen one, else the oldest shown. */
    noticeDay: string | null;
  } | null;
  /** Paging newer from a jump: there's more above, a page is loading, load the next. */
  newer: { has: boolean; loading: boolean; load: () => void };
};

/** A live document's title: its entry's, else its kind ("Note"). */
const liveTitle = (row: { kind: string; title: string | null }) =>
  row.title?.trim() || (isEntryKind(row.kind) ? KIND_META[row.kind].label : "Entry");

/**
 * Everything the timeline shows, live. Paging is here: scrolling near the end
 * calls `loadOlder`, which grows the local query's limit by a page (it asks
 * for one extra row to know there's more), and a change to any filter (the
 * search included) starts over from one page. While a larger window loads, the previous one
 * stays on screen, entries and "with …" lines alike (`pageWindow`). Back to
 * the timeline from a page outside it (an entry's) starts from the window it
 * left, rows and all, so the scroll position has somewhere to come back to
 * (`timelinePaging.ts`).
 */
export function useTimelineData({
  groupId,
  userId,
  filters,
  day = null,
  initial,
}: {
  groupId: string;
  userId: string;
  filters: EntryFilters;
  /** The day jumped to (`?day=`); the loader's `before` is its window's bound. */
  day?: string | null;
  initial: TimelineRows;
}): TimelineData {
  // The paging belongs to one set of filters (kind, author and search) and one jump: under any other, it's one page again.
  const filterKey = JSON.stringify([
    filters.kind,
    filters.author,
    filters.match ?? null,
    filters.vital ?? null,
    day,
  ]);
  // Back to this history entry starts from the window kept for it; anything else from one page.
  const location = useLocation();
  const { key: locationKey } = location;
  // A new jump (the marker, not Back to one) starts from its day, even the same day again.
  const navigationType = useNavigationType();
  const jumpMark = navigationType !== NavigationType.Pop && isJumpState(location.state) ? locationKey : null;
  const [returning] = useState(() => wasKept(userId, groupId, locationKey));
  const [start] = useState(() => ({
    initial,
    ...startPaging<EntryRow, EntryProviderLinkRow, EntryRow, EntryMedicationRow>(userId, groupId, {
      locationKey,
      filterKey,
    }),
  }));
  // The kept rows are the restored window's: they stand in for the loader's (one page) until the
  // watches answer, so the first render is as tall as the one left. New loader data replaces them.
  const restored = start.initial === initial ? start.rows : undefined;
  const [paging, setPaging] = useState({
    filterKey,
    mark: jumpMark,
    limit: start.limit,
    before: start.before === undefined ? initial.before : start.before,
    // The bound the rows on screen were read with, while a moved window loads.
    from: undefined as string | null | undefined,
  });
  const current = paging.filterKey === filterKey && !(jumpMark && jumpMark !== paging.mark);
  const requested = current ? paging.limit : PAGE_SIZE;
  const before = current ? paging.before : initial.before;
  const moving = current && paging.from !== undefined;

  // The history ends at a cutoff that moves on once a minute, so items cross
  // from the Today card's appointment into it without new rows.
  const cutoff = useHistoryCutoff(initial.cutoff);
  const entriesSql = historyQuery(groupId, filters, requested, cutoff, before);
  const entries = useLiveRows<EntryRow>(
    entriesSql.sql,
    entriesSql.params,
    restored?.entryRows ?? initial.entryRows,
  );
  const membersSql = membersQuery(groupId);
  const memberRows = useLiveQuery<MemberRow>(membersSql.sql, membersSql.params, initial.memberRows);
  const readingsSql = readingsQuery(groupId);
  const readingRows = useLiveQuery<ReadingRow>(readingsSql.sql, readingsSql.params, initial.readingRows);
  // Previews are rebuilt locally from the documents, so they include unsynced edits.
  const documentsSql = groupDocumentsQuery(groupId);
  const documentRows = useLiveQuery<NoteDocRow>(documentsSql.sql, documentsSql.params, initial.documentRows);
  const previews = useMemo(() => toPreviews(documentRows), [documentRows]);
  // One query for every loaded entry's links (the same window as the entries), never one per row.
  const linksSql = timelineLinksQuery(groupId, filters, requested, cutoff, before);
  const links = useLiveRows<EntryProviderLinkRow>(
    linksSql.sql,
    linksSql.params,
    restored?.linkRows ?? initial.linkRows,
  );
  const linkRows = links.rows;
  // What's ahead of the history: the Today card's appointment.
  const ahead = aheadQueries(groupId, filters, cutoff);
  const nextRows = useLiveQuery<EntryRow>(ahead.next.sql, ahead.next.params, initial.nextRows);
  const providersByEntry = useMemo(() => groupLinksByEntry(linkRows, fromLocalTimestamp), [linkRows]);
  // The rows last read whole, which stay up while a moved window loads.
  const windowFresh = entries.fresh && links.fresh;
  const [held, setHeld] = useState(entries.rows);
  // The window the rows on screen were fetched for: the cutoff's minute turn
  // refetches the same window, so it doesn't shrink the list while it does. A restored window
  // without its rows (past the cap) loads like any page, from the loader's one.
  const [settled, setSettled] = useState(restored ? requested : PAGE_SIZE);
  const zone = localTimeZone();
  // The day summaries read whole days, from the oldest shown day's baseline; nothing while filtered.
  const summariesHidden = summariesOff(filters);
  const oldestHeld = held.slice(0, settled).at(-1)?.occurred_at;
  const summarySql = daySummaryQuery(
    groupId,
    summarySince(oldestHeld ? fromLocalTimestamp(oldestHeld) : null, cutoff, zone),
    cutoff,
    summariesHidden,
    before,
  );
  const summaries = useLiveRows<EntryRow>(
    summarySql.sql,
    summarySql.params,
    restored?.summaryRows ?? initial.summaryRows,
  );
  const summaryRows = summaries.rows;
  // The new page shows once its windows are in, so no "with …" or summary line appears after it.
  const fresh = windowFresh && summaries.fresh;
  if (fresh && settled !== requested) setSettled(requested);
  if (fresh && held !== entries.rows) setHeld(entries.rows);
  const page = pageWindow({ rowCount: entries.rows.length, requested, fresh, settled });
  if (moving && fresh) setPaging({ ...paging, from: undefined });
  const waiting = !fresh && (page.loading || moving);
  const windowBefore = moving && !fresh ? (paging.from ?? null) : before;
  // Doses and medication changes are named by their medication: one query over the same window.
  const medications = useTimelineMedications(
    groupId,
    filters,
    requested,
    cutoff,
    restored?.medicationRows,
    before,
  );
  const medicationOf = medications.medicationOf;
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
  const shown = withPreview(wholeLogsPage(waiting ? held : entries.rows, page.limit, rowPassLogId));
  // The track, and its markers over the same window as the shown entries.
  const periods = useTimelinePeriods(groupId, initial);
  const markers = periodMarkers(periods.spans, {
    oldestLoaded: shown.at(-1)?.occurredAt ?? null,
    hasOlder: page.hasOlder,
    filtered: !!(filters.kind || filters.author || filters.match),
    before: windowBefore,
  });
  const now = new Date(cutoff);
  // Keep the settled window for this history entry, for Back to it after a remount.
  const settledWindow = fresh && settled === requested;
  useEffect(() => {
    if (!settledWindow) return;
    keepPaging(userId, groupId, {
      locationKey,
      filterKey,
      limit: requested,
      before,
      rows: { entryRows: entries.rows, linkRows: links.rows, summaryRows, medicationRows: medications.rows },
    });
  }, [
    settledWindow,
    userId,
    groupId,
    locationKey,
    filterKey,
    requested,
    before,
    entries.rows,
    links.rows,
    summaryRows,
    medications.rows,
  ]);

  const days = groupByDay(shown, zone, new Date());

  // Reading where the window moves next, off the device.
  const [readingNewer, setReadingNewer] = useState(false);
  const windowId = JSON.stringify([filterKey, jumpMark, before, requested]);
  const latestWindow = useRef(windowId);
  useEffect(() => {
    latestWindow.current = windowId;
  }, [windowId]);
  const loadNewer = () => {
    if (!before || readingNewer || waiting) return;
    const from = before;
    setReadingNewer(true);
    readNewerWindow(getSync(), groupId, filters, from, cutoff, zone)
      .then((next) => {
        // Another filter or a new jump while it read: this answer is for a window that's gone.
        if (latestWindow.current !== windowId) return;
        setPaging({
          filterKey,
          mark: jumpMark ?? paging.mark,
          limit: requested + next.added,
          before: next.before,
          from,
        });
      })
      // A failed local read leaves the window as it is; the next scroll tries again.
      .catch(() => undefined)
      .finally(() => setReadingNewer(false));
  };
  // The nearest day with entries, on or before the chosen one (keys sort as dates).
  const landedDay = day ? (days.find((d) => d.key <= day)?.key ?? null) : null;

  return {
    days,
    hasOlder: page.hasOlder,
    loadingOlder: page.loading,
    loadOlder: () => {
      if (page.loading || readingNewer || !page.hasOlder) return;
      setPaging({
        filterKey,
        mark: jumpMark ?? paging.mark,
        limit: nextLimit(page.limit),
        before,
        from: undefined,
      });
    },
    latestVitals: toLatestVitals(readingRows),
    liveDocuments,
    liveLabelOf: (id) => liveLabels.get(id),
    nameOf,
    imageOf: (id) => members.find((m) => m.userId === id)?.image ?? null,
    providersOf: (id) => providersByEntry.get(id),
    passNameOf: (id) => (id ? (passes.find((p) => p.id === id)?.name ?? null) : null),
    now,
    next: nextUp(toTimelineEntries(nextRows), now),
    periods,
    markers,
    summaryEntries: summariesHidden ? null : toTimelineEntries(summaryRows),
    restored: !!start.rows,
    returning,
    jump: day
      ? {
          day,
          bounded: !!windowBefore,
          before: windowBefore,
          notice: initial.before
            ? jumpNotice({
                day,
                shownDay: landedDay,
                filtered: !!(filters.kind || filters.author || filters.vital),
              })
            : null,
          noticeDay: landedDay ?? days.at(-1)?.key ?? null,
        }
      : null,
    newer: { has: !!windowBefore, loading: readingNewer || waiting, load: loadNewer },
  };
}
