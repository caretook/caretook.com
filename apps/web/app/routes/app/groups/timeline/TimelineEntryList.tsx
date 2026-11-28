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
import type { SectionAccent } from "~/lib/app-shell/sectionAccents";

import { canChangeEntry, canHaveNoteDocument, parseSearch } from "@caretook/data/schema";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  CancelEventDialog,
  OlderEntries,
  TimelineEntryRow,
  useEventCancel,
  useEventReschedule,
  useOpenTodoCounts,
  useRemindMe,
  useSeriesScope,
} from "~/components/entry";
import { ConfirmDialog, EmptyState, Message, Notice } from "~/components/ui";
import { canReschedule } from "~/lib/appointments/eventReschedule";
import { upcomingTitle } from "~/lib/appointments/upcomingLabels";
import { canRemind } from "~/lib/calendars/remindMe";
import { asksScope, ONLY_THIS_VISIT_STATE } from "~/lib/appointments/seriesScope";
import { dayLabel, localTimeZone } from "~/lib/core/format";
import { useGroup } from "~/lib/app-shell/group";
import { sectionAccent } from "~/lib/app-shell/sectionAccents";
import { useSymptomFilterTypes } from "~/lib/timeline/symptomFilter.sync";
import { clearSymptoms } from "~/lib/timeline/timelineFilters";
import { emptyTimelineText } from "~/lib/timeline/entryLabels";
import { SEARCH_END_TEXT, searchAnnouncement, searchStateText } from "./timelineSearch";
import { entryOpen } from "~/lib/timeline/entryOpen";
import { appUrls } from "~/lib/app-shell/appUrls";
import { BackToToday } from "./BackToToday";
import { DayHeader } from "./DayHeader";
import { foldPassLogs } from "./dayItems";
import { NewerEntries } from "./NewerEntries";
import { PassLogItem } from "./PassLogItem";
import { PeriodMarkerItem } from "./PeriodMarkerItem";
import { COLUMN_CAP, ROWS_BOX } from "./layout";
import { OFFSCREEN_ROWS, ROW_SIZE, settledDays } from "./offscreenRows";
import { summariesByDay } from "./daySummary";
import { DaySummaryLine } from "./DaySummaryLine";
import { SHEET_LINK_STATE } from "./sheet";
import { TimelineEntryCard } from "./TimelineEntryCard";
import { dayKeyIn, shortDayLabel, withMarkers } from "~/lib/timeline/timelineDays";
import { QuickAddPrefetch } from "./QuickAddMenu";
import { useEntryRemoval } from "./useEntryRemoval";
import { useJumpLanding } from "./useJumpLanding";
import { useGroupRecordTags } from "~/components/tags";

// The entries' column (1024 px from `lg`), shared with the quick-add bar and the filter chips.
export { COLUMN_CAP } from "./layout";

const NO_SEARCH = { q: "", state: "none" } as const;

/** The empty Today's line (a writer's unfiltered full view with nothing logged today). */
export const EMPTY_TODAY_TEXT = "Nothing logged today yet.";

/** Easy mode's larger list: everything in it, text, icons and taps alike, a quarter bigger. */
/** Easy mode shows no care period markers. */
const NO_MARKERS: never[] = [];
/** No day skips its rows (a restored window's first frames). */
const NO_SETTLED = new Set<string>();

const LIST_CLASS: Record<TimelineView, string> = {
  rows: `mt-2 divide-base-300 divide-y ${ROWS_BOX}`,
  // One column at every width: side-by-side cards are hard to read in time order.
  cards: "mt-2 space-y-2",
};

/** The filters and search a list shows (the URL's), as `TimelineEntryList` takes them. */
const NO_SYMPTOMS: readonly string[] = [];

export type TimelineEntryListFilters = {
  kind: TimelineEntryKind | null;
  author: string | null;
  vital?: VitalType | null;
  symptoms?: readonly string[];
  tag?: { id: string; name: string } | null;
  search?: { q: string; state: TimelineSearchState };
};

/**
 * The entries, a section per day under a sticky heading (with the care
 * period that covers the day: `DayHeader`), as rows or cards,
 * with the care periods' boundary markers at their moments (filters on or
 * off; a day with only a marker gets its own section), each day's summary
 * line in its sticky header while no filter or search is on, then `OlderEntries`,
 * which loads older pages as the end comes near. Writers get each entry's ⋯ menu (an Easy
 * helper, those of the entries they made), with one delete confirm for the whole list, and each day heading's + menu; a writer's list
 * always has a Today heading, so today's + is always there. With no filter or
 * search on and nothing logged today, that heading says so and offers "Add an
 * entry" (`onAddEntry`), in place of the empty timeline's line. An empty
 * list under the symptom-type filter names the chosen types and offers "Show
 * all symptoms" (`clearSymptoms`).
 *
 * `easy` is easy mode's list: rows only, at the full timeline's type
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
  symptoms = NO_SYMPTOMS,
  tag = null,
  search: searching = NO_SEARCH,
  easy = false,
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
    | "richTextOf"
    | "imageOf"
    | "passNameOf"
    | "markers"
    | "periods"
    | "summaryEntries"
    | "restored"
    | "returning"
    | "jump"
    | "newer"
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
  /** The symptom-type filter's catalog ids (`?symptom=`), when it's on. */
  symptoms?: readonly string[];
  /** The tag filter (`?tag=`), when it's on (the empty list names it). */
  tag?: { id: string; name: string } | null;
  /** The search (`?q=`) and what it's doing (`timelineSearch`). */
  search?: { q: string; state: TimelineSearchState };
  /** Easy mode's list (above). */
  easy?: boolean;
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
  const group = useGroup();
  // The open-todo marks: one live query for the group (none in easy mode).
  const openTodos = useOpenTodoCounts(groupId, !easy);
  // Edit and Delete: writers on every row, an Easy helper on the rows they made (`canChangeEntry`).
  const mayChange = (createdBy: string | null) =>
    canWrite || canChangeEntry({ role: group.role, userId: group.userId, entry: { createdBy } });
  // Tags (tags PRD): one live query for every row's quick tags (`RowTags`; no Tags in ⋯).
  const entryTags = useGroupRecordTags(groupId, "entry");
  // The markers, placed among the entries by moment in the viewer's days; their times are the recipient's.
  const recipientZone = group.recipient?.timeZone ?? "UTC";
  const now = new Date();
  const timeZone = localTimeZone();
  const days = withMarkers(data.days, easy ? NO_MARKERS : data.markers, timeZone, now);
  const todayKey = dayKeyIn(now.toISOString(), timeZone);
  const adding = canWrite && !easy;
  // Nothing logged today, with no filter or search on: the Today heading says so (`EmptyToday`).
  const unfiltered = !kind && !author && !vital && !searching.q;
  // A jump's window that stops short of today has no Today heading or prompt.
  const reachesToday = !data.jump?.bounded;
  const emptyToday = adding && unfiltered && reachesToday && data.days[0]?.key !== todayKey;
  // No entries at all, with nothing filtering them: the section's icon above the line. Easy mode stays neutral.
  const emptyMark =
    unfiltered && data.days.length === 0
      ? sectionAccent("timeline", { easy: easy || group.easyRole })
      : undefined;
  const sections =
    adding && reachesToday && days[0]?.key !== todayKey
      ? [
          {
            key: todayKey,
            label: dayLabel(now.toISOString(), timeZone, now),
            short: shortDayLabel(todayKey, timeZone, now),
            entries: [],
          },
          ...days,
        ]
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
  // So are days added above a jump's window: drawn once, so no estimated height moves the page.
  const windowBound = data.jump?.before ?? null;
  const [drawnBound, setDrawnBound] = useState(windowBound);
  if (drawnBound !== windowBound) {
    setDrawnBound(windowBound);
    setDrawAll(true);
  }
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
  const filterKey = `${kind}|${vital}|${symptoms.join(",")}|${tag?.id}|${author}|${searching.q}`;
  const lastFilter = useRef(filterKey);
  useLayoutEffect(() => {
    if (lastFilter.current === filterKey) return;
    lastFilter.current = filterKey;
    const el = list.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
  }, [filterKey]);
  // A jump lands on its day (only a jump: sheets and Back keep the scroll).
  const landed = useJumpLanding(list, !!data.jump, data.returning);

  // The symptom-type filter's names, for the empty list ("No pain or nausea …"), with a way back to every symptom.
  const symptomTypes = useSymptomFilterTypes(groupId);
  const symptomNames = symptoms.flatMap((id) => symptomTypes.find((t) => t.id === id)?.name ?? []);
  const emptyText = emptyTimelineText(
    kind,
    author && data.nameOf(author),
    searching.q,
    vital,
    symptomNames,
    tag?.name,
  );
  const clearSymptomsAction =
    kind === "symptom" && symptoms.length > 0
      ? { label: "Show all symptoms", to: { search: clearSymptoms(search) } }
      : undefined;
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
    const open = entryOpen({ groupId, entry, canWrite: mayChange(entry.createdBy), search });
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
          mayChange(entry.createdBy)
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
        richText={view === "cards" && canHaveNoteDocument(entry.kind) ? data.richTextOf(entry.id) : undefined}
        search={marked ? parsed : undefined}
        easy={easy}
        openTodos={canHaveNoteDocument(entry.kind) ? openTodos.get(entry.id) : undefined}
        tags={entryTags.get(entry.id)}
      />
    );
  };

  // Beside the day it's about, so newer days loaded above don't come between them.
  const jumpNotice = data.jump?.notice && (
    <Notice tone="info" role="status" data-jump-notice="">
      {data.jump.notice}
    </Notice>
  );

  return (
    <>
      <section
        ref={list}
        aria-labelledby="timeline-heading"
        className={`space-y-4 ${COLUMN_CAP} ${data.jump ? "pb-16" : ""} ${data.jump?.bounded ? "[overflow-anchor:none]" : ""}`}
        data-easy-list={easy ? "" : undefined}
      >
        <h2 id="timeline-heading" className="sr-only">
          Timeline
        </h2>
        {(removal.error || cancelling.error || scope.error) && (
          <Message tone="error">{removal.error ?? cancelling.error ?? scope.error}</Message>
        )}
        {/* Always there, so a search's first result is announced too. */}
        <p role="status" className="sr-only" data-search-status>
          {announcement}
        </p>
        {data.jump && (
          <NewerEntries newer={data.newer} armed={landed} empty={data.days.length === 0} list={list} />
        )}
        {!sections.some((day) => day.key === data.jump?.noticeDay) && jumpNotice}
        {sections.map((day) => (
          <section key={day.key} aria-labelledby={`day-${day.key}`}>
            {day.key === data.jump?.noticeDay && <div className="mb-4">{jumpNotice}</div>}
            <DayHeader
              dayKey={day.key}
              label={day.label}
              short={day.short}
              newestAt={day.entries[0]?.occurredAt}
              groupId={groupId}
              periods={data.periods}
              easy={easy}
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
                      sheetTo={
                        it.entries.every((e) => mayChange(e.createdBy))
                          ? appUrls.passSheet(groupId, it.id, { search })
                          : undefined
                      }
                    />
                  ),
                )}
              </ol>
            )}
            {emptyToday && day.key === todayKey && <EmptyToday onAddEntry={onAddEntry} mark={emptyMark} />}
          </section>
        ))}
        {/* After the headings, so a writer's empty timeline starts with Today's +. */}
        {data.days.length === 0 &&
          !emptyToday &&
          !data.jump?.notice &&
          (emptyMark ? (
            <EmptyState {...emptyMark} data-empty="">
              {emptyText}
            </EmptyState>
          ) : (
            <EmptyState data-empty="" action={clearSymptomsAction}>
              {searchStateText(searching.state) ?? emptyText}
            </EmptyState>
          ))}
        {adding && <QuickAddPrefetch groupId={groupId} />}

        <OlderEntries
          hasOlder={data.hasOlder}
          loading={data.loadingOlder}
          empty={data.days.length === 0}
          onLoadOlder={data.loadOlder}
          endText={searching.q ? SEARCH_END_TEXT : undefined}
        />
      </section>
      {data.jump && <BackToToday groupId={groupId} />}

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

/**
 * Under an empty Today: a muted line and "Add an entry" (when there's a
 * quick-entry box to go to). `mark`: the timeline has no entries at all, so
 * the section's icon sits above the line.
 */
function EmptyToday({ onAddEntry, mark }: { onAddEntry?: () => void; mark?: SectionAccent }) {
  return (
    <div className={`mt-2 px-3 py-3 ${ROWS_BOX}`} data-empty-today>
      <EmptyState {...mark} action={onAddEntry ? { label: "Add an entry", onAction: onAddEntry } : undefined}>
        {EMPTY_TODAY_TEXT}
      </EmptyState>
    </div>
  );
}
