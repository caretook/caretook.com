import type { EntryViewProps } from "./TimelineEntryRow";

import { entrySummary, KIND_META } from "~/lib/entryDisplay";
import { formatTime, formatTimeInZone } from "~/lib/format";
import { EntryActions } from "./EntryActions";
import { KindIcon } from "./KindIcon";
import { LiveNotesPreview } from "./LiveNotesPreview";
import { actionsLabel, entryLabel, liveNotesAction, Readings } from "./TimelineEntryRow";

/** One entry as a compact card: summary and time on one line, the full text, then who wrote it. */
export function TimelineEntryCard({
  entry,
  authorName,
  units,
  removing,
  onEdit,
  onDelete,
  liveNotes,
  onLiveNotes,
}: EntryViewProps) {
  const { heading, severity, readings, body } = entrySummary(entry, units);
  const elsewhere = formatTimeInZone(entry.occurredAt, entry.timeZone);
  // The first line is the title (or symptom name), else the readings, else the text itself.
  const lead = heading ? "heading" : readings.length ? "readings" : "body";

  return (
    <li
      className={`rounded-box border-base-300 bg-base-100 flex items-start gap-3 border p-3 ${removing ? "opacity-50" : ""}`}
    >
      <KindIcon kind={entry.kind} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <span className="sr-only">{KIND_META[entry.kind].label}: </span>
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0 break-words">
            {lead === "heading" && (
              <p className="font-semibold">
                {heading}
                {severity && <span className="text-base-content/70 font-normal"> · {severity}</span>}
              </p>
            )}
            {lead === "readings" && <Readings readings={readings} />}
            {lead === "body" && <p className="whitespace-pre-wrap">{body}</p>}
          </div>
          <time dateTime={entry.occurredAt} className="text-base-content/70 shrink-0 text-sm tabular-nums">
            {formatTime(entry.occurredAt)}
          </time>
        </div>
        {lead === "heading" && readings.length > 0 && <Readings readings={readings} />}
        {body && lead !== "body" && <p className="break-words whitespace-pre-wrap">{body}</p>}
        {liveNotes && <LiveNotesPreview notes={liveNotes} entryLabel={entryLabel(entry)} />}
        <p className="text-base-content/60 text-xs">
          {authorName}
          {elsewhere && ` · ${elsewhere}`}
        </p>
      </div>
      {onEdit && onDelete && (
        <EntryActions
          label={actionsLabel(entry)}
          onEdit={onEdit}
          onDelete={onDelete}
          liveNotes={liveNotesAction({ liveNotes, onLiveNotes })}
        />
      )}
    </li>
  );
}
