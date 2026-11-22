import type { TimelineData } from "./useTimelineData";
import type {
  DaySummaryMode,
  TimelineEntryKind,
  TimelineView,
  UnitChoices,
  VitalType,
} from "@caretook/data/schema";
import type { TimelineEntry } from "~/lib/core/rpc";
import type { TimelineSearchState } from "./timelineSearch";

import { parseSearch } from "@caretook/data/schema";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  CancelEventDialog,
  OlderEntries,
  useEventCancel,
  useEventReschedule,
  useRemindMe,
  useSeriesScope,
} from "~/components/entry";
import { ConfirmDialog } from "~/components/ui";
import { canReschedule } from "~/lib/appointments/eventReschedule";
import { upcomingTitle } from "~/lib/appointments/upcomingLabels";
import { canRemind } from "~/lib/calendars/remindMe";
import { asksScope, ONLY_THIS_VISIT_STATE } from "~/lib/appointments/seriesScope";
import { dayLabel, localTimeZone } from "~/lib/core/format";
import { useGroup } from "~/lib/app-shell/group";
import { emptyTimelineText } from "./entryLabels";
import { SEARCH_END_TEXT, searchAnnouncement, searchStateText } from "./timelineSearch";
import { entryOpen } from "~/lib/timeline/entryOpen";
import { appUrls } from "~/lib/app-shell/appUrls";
import { DayHeader } from "./DayHeader";
import { foldPassLogs } from "./dayItems";
import { PassLogItem } from "./PassLogItem";
import { PeriodMarkerItem } from "./PeriodMarkerItem";
import { COLUMN_CAP, ROWS_BOX } from "./layout";
import { OFFSCREEN_ROWS, ROW_SIZE, settledDays } from "./offscreenRows";
import { summariesByDay } from "./daySummary";
import { DaySummaryLine } from "./DaySummaryLine";
import { SHEET_LINK_STATE } from "./sheet";
import { TimelineEntryCard } from "./TimelineEntryCard";
import { TimelineEntryRow } from "./TimelineEntryRow";
import { dayKeyIn, withMarkers } from "./timelineDays";
import { QuickAddPrefetch } from "./QuickAddMenu";
import { useEntryRemoval } from "./useEntryRemoval";

// The entries' column (1024 px from `lg`), shared with the quick-add bar and the filter chips.
export { COLUMN_CAP } from "./layout";

const NO_SEARCH = { q: "", state: "none" } as const;

/** The empty Today's line (a writer's unfiltered full view with nothing logged today). */
export const EMPTY_TODAY_TEXT = "Nothing logged today yet.";

/** Simple mode's larger list: everything in it, text, icons and taps alike, a quarter bigger. */
/** Simple mode shows no care period markers. */
const NO_MARKERS: never[] = [];
/** No day skips its rows (a restored window's first frames). */
const NO_SETTLED = new Set<string>();

const LIST_CLASS: Record<TimelineView, string> = {
  rows: `mt-2 divide-base-300 divide-y ${ROWS_BOX}`,
  // One column at every width: side-by-side cards are hard to read in time order.
  cards: "mt-2 space-y-2",
};

/** The filters and search a list shows (the URL's), as `TimelineEntryList` takes them. */
export type TimelineEntryListFilters = {
  kind: TimelineEntryKind | null;
  author: string | null;
  vital?: VitalType | null;
  search?: { q: string; state: TimelineSearchState };
};

/**
 * The entries, a section per day under a sticky heading (with the care
 * period that covers the day: `DayHeader`), as rows or cards,
 * with the care periods' boundary markers at their moments (filters on or
 * off; a day with only a marker gets its own section), each day's summary
 * line in its sticky header while no filter or search is on, then `OlderEntries`,
 * which loads older pages as the end comes near. Writers get each entry's ⋯ menu, with one delete
 * confirm for the whole list, and each day heading's + menu; a writer's list
 * always has a Today heading, so today's + is always there. With no filter or
 * search on and nothing logged today, that heading says so and offers "Add an
 * entry" (`onAddEntry`), in place of the empty timeline's line.
 *
 * `simple` is simple mode's list: rows only, at the full timeline's type
 * scale (no zoom), with no filter links, no + menus and no care periods (markers or the day headers'
 * Change); the ⋯ menus, sheets and delete confirm are the full timeline's.
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
  simple = false,
  summaryMode = "highlights",
  onAddEntry,
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
    | "restored"
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
  /** Simple mode's list (above). */
  simple?: boolean;
  /** The day summaries' setting: none, highlights (the default) or everything. */
  summaryMode?: DaySummaryMode;
  /** The empty Today's "Add an entry" (the full view brings the quick-entry field up). */
  onAddEntry?: () => void;
}) {
  const { search } = useLocation();
  const navigate = useNavigate();
  const removal = useEntryRemoval();
  const cancelling = useEventCancel();
  const rescheduling = useEventReschedule(groupId, canWrite);
  const remind = useRemindMe(groupId);
  // A series visit's Edit, Reschedule, Cancel and Delete ask Only this visit or This and later first.
  const scope = useSeriesScope(canWrite);
  // Writers reschedule or cancel an event (or undo the cancel) from its ⋯ menu.
  const cancelOf = (entry: TimelineEntry) =>
    canWrite && entry.kind === "event"
      ? {
          cancelled: !!entry.cancelledAt,
          onCancel: () => scope.ask(entry, "cancel", { only: () => cancelling.ask(entry.id) }),
          onUncancel: () => cancelling.undo(entry.id),
          onReschedule: canReschedule(entry)
            ? () => scope.ask(entry, "reschedule", { only: () => rescheduling.ask(entry) })
            : undefined,
        }
      : undefined;
  const editSeriesOf = (entry: TimelineEntry) =>
    canWrite && asksScope(entry, new Date())
      ? () =>
          scope.ask(entry, "edit", {
            only: () => void navigate(appUrls.entry(groupId, entry.id), { state: ONLY_THIS_VISIT_STATE }),
          })
      : undefined;
  const Entry = view === "cards" ? TimelineEntryCard : TimelineEntryRow;
  // The markers, placed among the entries by moment in the viewer's days; their times are the recipient's.
  const recipientZone = useGroup().recipient?.timeZone ?? "UTC";
  const now = new Date();
  const timeZone = localTimeZone();
  const days = withMarkers(data.days, simple ? NO_MARKERS : data.markers, timeZone, now);
  const todayKey = dayKeyIn(now.toISOString(), timeZone);
  const adding = canWrite && !simple;
  // Nothing logged today, with no filter or search on: the Today heading says so (`EmptyToday`).
  const emptyToday = adding && !kind && !author && !vital && !searching.q && data.days[0]?.key !== todayKey;
  const sections =
    adding && days[0]?.key !== todayKey
      ? [{ key: todayKey, label: dayLabel(now.toISOString(), timeZone, now), entries: [] }, ...days]
      : days;
  // Days before the newest page skip drawing their rows while off screen (`offscreenRows`).
  // A restored window's rows (Back to it, `timelinePaging.ts`) are new elements with no
  // remembered size, so its first frames draw them all: the page is as tall as the one left
  // when the scroll position comes back, and each row remembers its size before it skips again.
  const [drawAll, setDrawAll] = useState(data.restored);
  useEffect(() => {
    if (!drawAll) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setDrawAll(false));
    });
    return () => cancelAnimationFrame(frame);
  }, [drawAll]);
  const settled = drawAll ? NO_SETTLED : settledDays(sections);
  // Each day's summary line (none while a filter or search is on: `summaryEntries` is null then; none when they're off).
  const summaries =
    summaryMode !== "off" &&
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
    const open = entryOpen({ groupId, entry, canWrite, search });
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
            : editSeriesOf(entry)
        }
        onDelete={
          canWrite
            ? () =>
                scope.ask(entry, "delete", {
                  only: () => removal.ask(entry),
                  onlyChosen: () => removal.removeNow(entry),
                })
            : undefined
        }
        cancel={cancelOf(entry)}
        onRemind={
          canRemind(entry, new Date())
            ? () => remind.ask({ id: entry.id, title: upcomingTitle(entry) })
            : undefined
        }
        liveLabel={data.liveLabelOf(entry.id)}
        providers={data.providersOf(entry.id)}
        search={marked ? parsed : undefined}
        simple={simple}
      />
    );
  };

  return (
    <>
      <section
        ref={list}
        aria-labelledby="timeline-heading"
        className={`space-y-4 ${COLUMN_CAP}`}
        data-simple-list={simple ? "" : undefined}
      >
        <h2 id="timeline-heading" className="sr-only">
          Timeline
        </h2>
        {(removal.error || cancelling.error || scope.error) && (
          <p role="alert" className="text-error text-sm">
            {removal.error ?? cancelling.error ?? scope.error}
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
              summary={summaries && <DaySummaryLine summary={summaries.get(day.key)} mode={summaryMode} />}
            />
            {day.entries.length > 0 && (
              <ol
                className={`${LIST_CLASS[view]} ${ROW_SIZE[view]} ${settled.has(day.key) ? OFFSCREEN_ROWS : ""}`}
                data-view={view}
              >
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
                      sheetTo={canWrite ? appUrls.passSheet(groupId, it.id, { search }) : undefined}
                    />
                  ),
                )}
              </ol>
            )}
            {emptyToday && day.key === todayKey && <EmptyToday onAddEntry={onAddEntry} />}
          </section>
        ))}
        {/* After the headings, so a writer's empty timeline starts with Today's +. */}
        {data.days.length === 0 && !emptyToday && (
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
      {remind.sheet}
      {scope.element}
    </>
  );
}

/** Under an empty Today: a muted line and "Add an entry" (when there's a quick-entry box to go to). */
function EmptyToday({ onAddEntry }: { onAddEntry?: () => void }) {
  return (
    <div
      className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 ${ROWS_BOX}`}
      data-empty-today
    >
      <p className="text-base-content/70">{EMPTY_TODAY_TEXT}</p>
      {onAddEntry && (
        <button type="button" className="btn btn-sm btn-outline" onClick={onAddEntry}>
          Add an entry
        </button>
      )}
    </div>
  );
}
