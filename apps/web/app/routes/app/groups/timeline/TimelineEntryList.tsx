import type { TimelineData } from "./useTimelineData";
import type { TimelineEntryKind, TimelineView, UnitChoices, VitalType } from "@caretook/data/schema";
import type { TimelineEntry } from "~/lib/rpc";
import type { TimelineSearchState } from "./timelineSearch";

import { parseSearch } from "@caretook/data/schema";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { CancelEventDialog, OlderEntries, useEventCancel, useEventReschedule } from "~/components/entry";
import { ConfirmDialog } from "~/components/ui";
import { canReschedule } from "~/lib/eventReschedule";
import { dayLabel, localTimeZone } from "~/lib/format";
import { useGroup } from "~/lib/group";
import { emptyTimelineText } from "./entryLabels";
import { SEARCH_END_TEXT, searchAnnouncement, searchStateText } from "./timelineSearch";
import { entryOpen } from "~/lib/entryOpen";
import { appUrls } from "~/lib/appUrls";
import { DayHeader } from "./DayHeader";
import { foldPassLogs } from "./dayItems";
import { PassLogItem } from "./PassLogItem";
import { PeriodMarkerItem } from "./PeriodMarkerItem";
import { COLUMN_CAP } from "./layout";
import { summariesByDay } from "./daySummary";
import { DaySummaryLine } from "./DaySummaryLine";
import { SHEET_LINK_STATE } from "./sheet";
import { TimelineEntryCard } from "./TimelineEntryCard";
import { TimelineEntryRow } from "./TimelineEntryRow";
import { dayKeyIn, withMarkers } from "./timelineDays";
import { QuickAddPrefetch } from "./QuickAddMenu";
import { UpcomingBlock } from "./UpcomingBlock";
import { useEntryRemoval } from "./useEntryRemoval";

// The entries' column (1024 px from `lg`), shared with the quick-add bar and the filter chips.
export { COLUMN_CAP } from "./layout";

const NO_SEARCH = { q: "", state: "none" } as const;

/** Simple mode's larger list: everything in it, text, icons and taps alike, a quarter bigger. */
const SIMPLE_ZOOM = "[zoom:1.25]";
/** Simple mode shows no care period markers. */
const NO_MARKERS: never[] = [];

const LIST_CLASS: Record<TimelineView, string> = {
  rows: "rounded-box border-base-300 bg-base-100 divide-base-200 divide-y overflow-hidden border",
  // One column at every width: side-by-side cards are hard to read in time order.
  cards: "space-y-2",
};

/**
 * The entries, a section per day under a sticky heading (with the care
 * period that covers the day: `DayHeader`), as rows or cards,
 * with the care periods' boundary markers at their moments (filters on or
 * off; a day with only a marker gets its own section), each day's summary
 * line under its heading while no filter or search is on, then `OlderEntries`,
 * which loads older pages as the end comes near. With
 * `upcoming` (`?upcoming=1`), the Upcoming block comes first, above Today, in
 * the same rows or cards. Writers get each entry's ⋯ menu, with one delete
 * confirm for the whole list, and each day heading's + menu; a writer's list
 * always has a Today heading (empty when nothing's logged today), so today's
 * + is always there.
 *
 * `simple` is simple mode's list: rows only, shown larger (the whole list is
 * zoomed, so icons and taps grow with the text; `SIMPLE_ZOOM`), with no ⋯
 * menus, no filter links, no care periods (markers or the day headers'
 * period) and nothing to edit: notes and events open as usual, other rows
 * open nothing.
 */
export function TimelineEntryList({
  data,
  view,
  units,
  groupId,
  canWrite,
  kind,
  author,
  vital = null,
  search: searching = NO_SEARCH,
  upcoming,
  simple = false,
}: {
  data: Pick<
    TimelineData,
    | "days"
    | "hasOlder"
    | "loadingOlder"
    | "loadOlder"
    | "liveLabelOf"
    | "nameOf"
    | "providersOf"
    | "imageOf"
    | "passNameOf"
    | "markers"
    | "periods"
    | "summaryEntries"
  >;
  view: TimelineView;
  units: UnitChoices;
  groupId: string;
  canWrite: boolean;
  kind: TimelineEntryKind | null;
  /** The author filter's user id, when it's on (the empty list names them). */
  author: string | null;
  /** The vital-type filter (`?vital=`), when it's on (the empty list names it). */
  vital?: VitalType | null;
  /** The search (`?q=`) and what it's doing (`timelineSearch`). */
  search?: { q: string; state: TimelineSearchState };
  /** The Upcoming block, when it's on, and where its "See all in Upcoming" goes. */
  upcoming?: { items: TimelineData["upcoming"]; seeAll: string } | null;
  /** Simple mode's larger, read-only list (above). */
  simple?: boolean;
}) {
  const { search } = useLocation();
  const navigate = useNavigate();
  const removal = useEntryRemoval();
  const cancelling = useEventCancel();
  const rescheduling = useEventReschedule(groupId, canWrite);
  // Writers reschedule or cancel an event (or undo the cancel) from its ⋯ menu.
  const cancelOf = (entry: TimelineEntry) =>
    canWrite && !simple && entry.kind === "event"
      ? {
          cancelled: !!entry.cancelledAt,
          onCancel: () => cancelling.ask(entry.id),
          onUncancel: () => cancelling.undo(entry.id),
          onReschedule: canReschedule(entry) ? () => rescheduling.ask(entry) : undefined,
        }
      : undefined;
  const Entry = view === "cards" ? TimelineEntryCard : TimelineEntryRow;
  // The markers, placed among the entries by moment in the viewer's days; their times are the recipient's.
  const recipientZone = useGroup().recipient?.timeZone ?? "UTC";
  const now = new Date();
  const timeZone = localTimeZone();
  const days = withMarkers(data.days, simple ? NO_MARKERS : data.markers, timeZone, now);
  const todayKey = dayKeyIn(now.toISOString(), timeZone);
  const adding = canWrite && !simple;
  const sections =
    adding && days[0]?.key !== todayKey
      ? [{ key: todayKey, label: dayLabel(now.toISOString(), timeZone, now), entries: [] }, ...days]
      : days;
  // Each day's summary line (none while a filter or search is on: `summaryEntries` is null then).
  const summaries =
    data.summaryEntries &&
    summariesByDay(
      data.summaryEntries,
      sections.map((d) => d.key),
      timeZone,
      { units, nameOf: data.nameOf },
    );

  // A new filter starts again from the newest entry: when the list's top is
  // above the screen (a kind icon or author tapped far down), bring it back,
  // before the end of a shorter list could load another page.
  const list = useRef<HTMLElement>(null);
  const filterKey = `${kind}|${vital}|${author}|${searching.q}`;
  const lastFilter = useRef(filterKey);
  useLayoutEffect(() => {
    if (lastFilter.current === filterKey) return;
    lastFilter.current = filterKey;
    const el = list.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
  }, [filterKey]);

  const emptyText = emptyTimelineText(kind, author && data.nameOf(author), searching.q, vital);
  const announcement = searchAnnouncement({
    q: searching.q,
    state: searching.state,
    shown: data.days.reduce((n, day) => n + day.entries.length, 0),
    hasOlder: data.hasOlder,
    emptyText,
  });

  // Matches are marked in the history's rows and cards (the Upcoming block stays as it is).
  const parsed = useMemo(() => (searching.q ? parseSearch(searching.q) : undefined), [searching.q]);
  const item = (entry: TimelineEntry, marked = false) => {
    const open = entryOpen({ groupId, entry, canWrite: canWrite && !simple, search });
    return (
      <Entry
        key={entry.id}
        entry={entry}
        authorName={data.nameOf(entry.createdBy)}
        authorImage={data.imageOf(entry.createdBy)}
        units={units}
        removing={removal.isRemoving(entry.id)}
        open={open}
        onEdit={
          open?.sheet
            ? () => void navigate(open.to, { state: SHEET_LINK_STATE, preventScrollReset: true })
            : undefined
        }
        onDelete={canWrite && !simple ? () => removal.ask(entry) : undefined}
        cancel={cancelOf(entry)}
        liveLabel={data.liveLabelOf(entry.id)}
        providers={data.providersOf(entry.id)}
        search={marked ? parsed : undefined}
        simple={simple}
      />
    );
  };

  return (
    <>
      {upcoming && (
        <div className={COLUMN_CAP}>
          <UpcomingBlock
            upcoming={upcoming.items}
            view={view}
            listClass={LIST_CLASS[view]}
            seeAll={upcoming.seeAll}
            entry={(entry) => item(entry)}
          />
        </div>
      )}
      <section
        ref={list}
        aria-labelledby="timeline-heading"
        className={`space-y-4 ${COLUMN_CAP} ${simple ? SIMPLE_ZOOM : ""}`}
        data-simple-list={simple ? "" : undefined}
      >
        <h2 id="timeline-heading" className="sr-only">
          Timeline
        </h2>
        {cancelling.error && (
          <p role="alert" className="text-error text-sm">
            {cancelling.error}
          </p>
        )}
        {/* Always there, so a search's first result is announced too. */}
        <p role="status" className="sr-only" data-search-status>
          {announcement}
        </p>
        {sections.map((day) => (
          <section key={day.key} aria-labelledby={`day-${day.key}`}>
            <DayHeader
              dayKey={day.key}
              label={day.label}
              newestAt={day.entries[0]?.occurredAt}
              groupId={groupId}
              periods={data.periods}
              simple={simple}
            />
            {summaries && <DaySummaryLine summary={summaries.get(day.key)} />}
            {day.entries.length > 0 && (
              <ol className={LIST_CLASS[view]} data-view={view}>
                {/* Doses logged in one round fold into one pass log; care period markers keep their moments. */}
                {foldPassLogs(day.entries).map((it) =>
                  it.type === "entry" ? (
                    item(it.entry, true)
                  ) : it.type === "marker" ? (
                    <PeriodMarkerItem
                      key={it.key}
                      marker={it.marker}
                      groupId={groupId}
                      timeZone={recipientZone}
                      placeName={data.periods.placeName}
                      view={view}
                    />
                  ) : (
                    <PassLogItem
                      key={it.id}
                      view={view}
                      passLogId={it.id}
                      passName={data.passNameOf(it.passId)}
                      doses={it.entries}
                      occurredAt={it.occurredAt}
                      authorName={data.nameOf(it.entries[0]!.createdBy)}
                      authorImage={data.imageOf(it.entries[0]!.createdBy)}
                      sheetTo={
                        canWrite && !simple ? appUrls.passSheet(groupId, it.id, { search }) : undefined
                      }
                    />
                  ),
                )}
              </ol>
            )}
          </section>
        ))}
        {/* After the headings, so a writer's empty timeline starts with Today's +. */}
        {data.days.length === 0 && (
          <p className="text-base-content/70" data-empty>
            {searchStateText(searching.state) ?? emptyText}
          </p>
        )}
        {adding && <QuickAddPrefetch groupId={groupId} />}

        <OlderEntries
          hasOlder={data.hasOlder}
          loading={data.loadingOlder}
          empty={data.days.length === 0}
          onLoadOlder={data.loadOlder}
          endText={searching.q ? SEARCH_END_TEXT : undefined}
        />
      </section>

      <ConfirmDialog
        open={removal.asking}
        title="Delete this entry?"
        confirmLabel="Delete"
        onClose={removal.cancel}
        onConfirm={removal.confirm}
      />
      <CancelEventDialog open={cancelling.asking} onConfirm={cancelling.confirm} onClose={cancelling.close} />
      {rescheduling.sheet}
    </>
  );
}
