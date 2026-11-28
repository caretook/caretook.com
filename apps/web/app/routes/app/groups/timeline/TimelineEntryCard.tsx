import type { EntryViewProps } from "~/components/entry";

import {
  AuthorFilterLink,
  CANCELLED_TEXT,
  CancelledBadge,
  EntryBody,
  EntryMenu,
  EntryOpenTarget,
  KindFilterLink,
  LiveDot,
  OpenTodosMark,
  RepeatMark,
  RowTags,
} from "~/components/entry";
import { ViaTag } from "~/components/ui";
import { formatTime, formatTimeInZone } from "~/lib/core/format";
import { cancelledLabel } from "~/lib/appointments/upcomingLabels";

/** One entry as a compact card: the body's first line beside the time, all its text (a note's or event's formatted), then who wrote it. */
export function TimelineEntryCard({
  entry,
  authorName,
  units,
  removing,
  open,
  onEdit,
  onDelete,
  cancel,
  onRemind,
  liveLabel,
  providers,
  richText,
  search,
  openTodos,
  tags,
}: EntryViewProps) {
  const elsewhere = formatTimeInZone(entry.occurredAt, entry.timeZone);
  const cancelled = cancelledLabel(entry);
  return (
    <li
      className={`rounded-box border-base-300 bg-base-100 relative isolate flex items-start gap-3 border p-3 shadow-sm ${removing ? "opacity-50" : ""}`}
      data-cancelled={cancelled ? "" : undefined}
    >
      {open && <EntryOpenTarget open={open} entry={entry} />}
      <KindFilterLink kind={entry.kind} />
      <EntryBody
        entry={entry}
        units={units}
        providers={providers}
        richText={richText}
        search={search}
        className={`space-y-0.5 ${cancelled ? CANCELLED_TEXT : ""}`}
        aside={
          <>
            {liveLabel && <LiveDot label={liveLabel} />}
            <time dateTime={entry.occurredAt} className="text-muted text-sm tabular-nums">
              {entry.allDay ? "All day" : formatTime(entry.occurredAt)}
            </time>
            <RepeatMark seriesId={entry.seriesId} className="text-muted" />
          </>
        }
        footer={
          <>
            {cancelled && <CancelledBadge label={cancelled} />}
            <OpenTodosMark count={openTodos} />
            <RowTags entry={entry} tags={tags} />
            <p className="text-faint inline-block w-full text-xs">
              <AuthorFilterLink userId={entry.createdBy} name={authorName} />
              <ViaTag via={entry.via} className="ml-1.5" />
              {elsewhere && ` · ${elsewhere}`}
            </p>
          </>
        }
      />
      <EntryMenu entry={entry} onEdit={onEdit} cancel={cancel} onRemind={onRemind} onDelete={onDelete} />
    </li>
  );
}
