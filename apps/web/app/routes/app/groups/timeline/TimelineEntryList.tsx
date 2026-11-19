import type { TimelineData } from "./useTimelineData";
import type { TimelineEntryKind, TimelineView, UnitChoices } from "@caretook/data/schema";
import type { TimelineEntry } from "~/lib/rpc";

import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { CancelEventDialog, OlderEntries, useEventCancel, useEventReschedule } from "~/components/entry";
import { ConfirmDialog } from "~/components/ui";
import { canReschedule } from "~/lib/eventReschedule";
import { localTimeZone } from "~/lib/format";
import { useGroup } from "~/lib/group";
import { emptyTimelineText } from "./entryLabels";
import { entryOpen } from "./entryOpen";
import { PeriodMarkerItem } from "./PeriodMarkerItem";
import { COLUMN_CAP } from "./layout";
import { SHEET_LINK_STATE } from "./sheet";
import { TimelineEntryCard } from "./TimelineEntryCard";
import { TimelineEntryRow } from "./TimelineEntryRow";
import { withMarkers } from "./timelineDays";
import { UpcomingBlock } from "./UpcomingBlock";
import { useEntryRemoval } from "./useEntryRemoval";

// The entries' column (1024 px from `lg`), shared with the quick-add bar and the filter chips.
export { COLUMN_CAP } from "./layout";

const LIST_CLASS: Record<TimelineView, string> = {
  rows: "rounded-box border-base-300 bg-base-100 divide-base-200 divide-y overflow-hidden border",
  // One column at every width: side-by-side cards are hard to read in time order.
  cards: "space-y-2",
};

/**
 * The entries, a section per day under a sticky heading, as rows or cards,
 * with the care periods' boundary markers at their moments (filters on or
 * off; a day with only a marker gets its own section), then `OlderEntries`,
 * which loads older pages as the end comes near. With
 * `upcoming` (`?upcoming=1`), the Upcoming block comes first, above Today, in
 * the same rows or cards. Writers get each entry's ⋯ menu, with one delete
 * confirm for the whole list.
 */
export function TimelineEntryList({
  data,
  view,
  units,
  groupId,
  canWrite,
  kind,
  author,
  upcoming,
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
    | "markers"
    | "periods"
  >;
  view: TimelineView;
  units: UnitChoices;
  groupId: string;
  canWrite: boolean;
  kind: TimelineEntryKind | null;
  /** The author filter's user id, when it's on (the empty list names them). */
  author: string | null;
  /** The Upcoming block, when it's on, and where its "See all in Upcoming" goes. */
  upcoming?: { items: TimelineData["upcoming"]; seeAll: string } | null;
}) {
  const { search } = useLocation();
  const navigate = useNavigate();
  const removal = useEntryRemoval();
  const cancelling = useEventCancel();
  const rescheduling = useEventReschedule(groupId, canWrite);
  // Writers reschedule or cancel an event (or undo the cancel) from its ⋯ menu.
  const cancelOf = (entry: TimelineEntry) =>
    canWrite && entry.kind === "event"
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
  const sections = withMarkers(data.days, data.markers, localTimeZone(), new Date());

  // A new filter starts again from the newest entry: when the list's top is
  // above the screen (a kind icon or author tapped far down), bring it back,
  // before the end of a shorter list could load another page.
  const list = useRef<HTMLElement>(null);
  const filterKey = `${kind}|${author}`;
  const lastFilter = useRef(filterKey);
  useLayoutEffect(() => {
    if (lastFilter.current === filterKey) return;
    lastFilter.current = filterKey;
    const el = list.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
  }, [filterKey]);

  const item = (entry: TimelineEntry) => {
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
            : undefined
        }
        onDelete={canWrite ? () => removal.ask(entry) : undefined}
        cancel={cancelOf(entry)}
        liveLabel={data.liveLabelOf(entry.id)}
        providers={data.providersOf(entry.id)}
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
            entry={item}
          />
        </div>
      )}
      <section ref={list} aria-labelledby="timeline-heading" className={`space-y-4 ${COLUMN_CAP}`}>
        <h2 id="timeline-heading" className="sr-only">
          Timeline
        </h2>
        {cancelling.error && (
          <p role="alert" className="text-error text-sm">
            {cancelling.error}
          </p>
        )}
        {data.days.length === 0 && (
          <p className="text-base-content/70" data-empty>
            {emptyTimelineText(kind, author && data.nameOf(author))}
          </p>
        )}
        {sections.map((day) => (
          <section key={day.key} aria-labelledby={`day-${day.key}`}>
            <h3
              id={`day-${day.key}`}
              className="bg-base-200/95 text-base-content sticky top-0 z-10 -mx-1 px-1 py-2 text-base font-semibold backdrop-blur lg:text-lg"
            >
              {day.label}
            </h3>
            <ol className={LIST_CLASS[view]} data-view={view}>
              {day.entries.map((it) =>
                it.type === "entry" ? (
                  item(it.entry)
                ) : (
                  <PeriodMarkerItem
                    key={it.key}
                    marker={it.marker}
                    groupId={groupId}
                    timeZone={recipientZone}
                    placeName={data.periods.placeName}
                    view={view}
                  />
                ),
              )}
            </ol>
          </section>
        ))}

        <OlderEntries
          hasOlder={data.hasOlder}
          loading={data.loadingOlder}
          empty={data.days.length === 0}
          onLoadOlder={data.loadOlder}
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
