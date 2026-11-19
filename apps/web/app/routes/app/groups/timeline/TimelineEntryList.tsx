import type { TimelineData } from "./useTimelineData";
import type { TimelineEntryKind, TimelineView, UnitChoices } from "@caretook/data/schema";
import type { TimelineEntry } from "~/lib/rpc";

import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { OlderEntries } from "~/components/entry";
import { ConfirmDialog } from "~/components/ui";
import { emptyTimelineText } from "./entryLabels";
import { entryOpen } from "./entryOpen";
import { SHEET_LINK_STATE } from "./sheet";
import { TimelineEntryCard } from "./TimelineEntryCard";
import { TimelineEntryRow } from "./TimelineEntryRow";
import { UpcomingBlock } from "./UpcomingBlock";
import { useEntryRemoval } from "./useEntryRemoval";

/**
 * The entries' column stops at 64rem (1024 px) on wide screens, centered on
 * the page. The quick-add bar and the filter chips share it; the header, the
 * vitals line and the Live now banner keep the full width.
 */
export const COLUMN_CAP = "mx-auto max-w-5xl";

const LIST_CLASS: Record<TimelineView, string> = {
  rows: "rounded-box border-base-300 bg-base-100 divide-base-200 divide-y overflow-hidden border",
  // One column at every width: side-by-side cards are hard to read in time order.
  cards: "space-y-2",
};

/**
 * The entries, a section per day under a sticky heading, as rows or cards,
 * then `OlderEntries`, which loads older pages as the end comes near. With
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
    "days" | "hasOlder" | "loadingOlder" | "loadOlder" | "liveLabelOf" | "nameOf" | "providersOf" | "imageOf"
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
  const Entry = view === "cards" ? TimelineEntryCard : TimelineEntryRow;

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
        {data.days.length === 0 && (
          <p className="text-base-content/70" data-empty>
            {emptyTimelineText(kind, author && data.nameOf(author))}
          </p>
        )}
        {data.days.map((day) => (
          <section key={day.key} aria-labelledby={`day-${day.key}`}>
            <h3
              id={`day-${day.key}`}
              className="bg-base-200/95 text-base-content sticky top-0 z-10 -mx-1 px-1 py-2 text-base font-semibold backdrop-blur lg:text-lg"
            >
              {day.label}
            </h3>
            <ol className={LIST_CLASS[view]} data-view={view}>
              {day.entries.map(item)}
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
    </>
  );
}
