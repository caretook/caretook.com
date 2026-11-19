import type { TimelineData } from "./useTimelineData";
import type { TimelineEntryKind, TimelineView, UnitChoices } from "@caretook/data/schema";

import { useLocation, useNavigate } from "react-router";
import { ConfirmDialog } from "~/components/ui";
import { emptyTimelineText } from "./entryLabels";
import { entryOpen } from "./entryOpen";
import { SHEET_LINK_STATE } from "./sheet";
import { TimelineEntryCard } from "./TimelineEntryCard";
import { TimelineEntryRow } from "./TimelineEntryRow";
import { useEntryRemoval } from "./useEntryRemoval";

const LIST_CLASS: Record<TimelineView, string> = {
  rows: "rounded-box border-base-300 bg-base-100 divide-base-200 divide-y overflow-hidden border",
  // One column on phones; from `lg` a grid inside each day, each card keeping its own height.
  cards: "grid grid-cols-1 items-start gap-2 lg:grid-cols-2 2xl:grid-cols-3",
};

/**
 * The entries, a section per day under a sticky heading, as rows or cards,
 * then "Show older entries" while there are more. Writers get each entry's
 * ⋯ menu, with one delete confirm for the whole list.
 */
export function TimelineEntryList({
  data,
  view,
  units,
  groupId,
  canWrite,
  kind,
}: {
  data: Pick<TimelineData, "days" | "hasOlder" | "showOlder" | "liveLabelOf" | "nameOf" | "providersOf">;
  view: TimelineView;
  units: UnitChoices;
  groupId: string;
  canWrite: boolean;
  kind: TimelineEntryKind | null;
}) {
  const { search } = useLocation();
  const navigate = useNavigate();
  const removal = useEntryRemoval();
  const Entry = view === "cards" ? TimelineEntryCard : TimelineEntryRow;

  return (
    <>
      <section aria-labelledby="timeline-heading" className="space-y-4">
        <h2 id="timeline-heading" className="sr-only">
          Timeline
        </h2>
        {data.days.length === 0 && <p className="text-base-content/70">{emptyTimelineText(kind)}</p>}
        {data.days.map((day) => (
          <section key={day.key} aria-labelledby={`day-${day.key}`}>
            <h3
              id={`day-${day.key}`}
              className="bg-base-200/95 text-base-content sticky top-0 z-10 -mx-1 px-1 py-2 text-base font-semibold backdrop-blur lg:text-lg"
            >
              {day.label}
            </h3>
            <ol className={LIST_CLASS[view]} data-view={view}>
              {day.entries.map((entry) => {
                const open = entryOpen({ groupId, entry, canWrite, search });
                return (
                  <Entry
                    key={entry.id}
                    entry={entry}
                    authorName={data.nameOf(entry.createdBy)}
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
              })}
            </ol>
          </section>
        ))}

        {data.hasOlder && (
          <button type="button" className="btn btn-block" onClick={data.showOlder}>
            Show older entries
          </button>
        )}
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
