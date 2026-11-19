import type { EntryViewProps } from "./TimelineEntryRow";

import { AuthorFilterLink, EntryActions, EntryBody, KindFilterLink } from "~/components/entry";
import { formatTime, formatTimeInZone } from "~/lib/format";
import { cancelledLabel } from "~/lib/upcomingLabels";
import { actionsLabel } from "./entryLabels";
import { EntryOpenTarget } from "./EntryOpenTarget";
import { LiveDot } from "./LiveDot";
import { CANCELLED_TEXT, CancelledBadge } from "./TimelineEntryRow";

/** One entry as a compact card: the body's first line beside the time, all its text, then who wrote it. */
export function TimelineEntryCard({
  entry,
  authorName,
  units,
  removing,
  open,
  onEdit,
  onDelete,
  cancel,
  liveLabel,
  providers,
}: EntryViewProps) {
  const elsewhere = formatTimeInZone(entry.occurredAt, entry.timeZone);
  const cancelled = cancelledLabel(entry);
  return (
    <li
      className={`rounded-box border-base-300 bg-base-100 relative isolate flex items-start gap-3 border p-3 ${removing ? "opacity-50" : ""}`}
      data-cancelled={cancelled ? "" : undefined}
    >
      {open && <EntryOpenTarget open={open} entry={entry} />}
      <KindFilterLink kind={entry.kind} />
      <EntryBody
        entry={entry}
        units={units}
        providers={providers}
        className={`space-y-0.5 ${cancelled ? CANCELLED_TEXT : ""}`}
        aside={
          <>
            {liveLabel && <LiveDot label={liveLabel} />}
            <time dateTime={entry.occurredAt} className="text-base-content/70 text-sm tabular-nums">
              {entry.allDay ? "All day" : formatTime(entry.occurredAt)}
            </time>
          </>
        }
        footer={
          <>
            {cancelled && <CancelledBadge label={cancelled} />}
            <p className="text-base-content/60 inline-block w-full text-xs">
              <AuthorFilterLink userId={entry.createdBy} name={authorName} />
              {elsewhere && ` · ${elsewhere}`}
            </p>
          </>
        }
      />
      {onDelete && (
        <EntryActions
          kind={entry.kind}
          label={actionsLabel(entry)}
          onEdit={onEdit}
          cancel={cancel}
          onDelete={onDelete}
        />
      )}
    </li>
  );
}
