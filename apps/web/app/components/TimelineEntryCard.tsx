import type { UnitChoices } from "@caretook/data/schema";
import type { TimelineEntry } from "~/lib/rpc";

import { useCallback, useState } from "react";
import { useFetcher } from "react-router";
import {
  formatReading,
  isKnownReading,
  isSymptomDetails,
  isVitalDetails,
  TIMELINE_LIMITS,
} from "@caretook/data/schema";
import { formatTime, formatTimeInZone } from "~/lib/format";
import { ConfirmDialog } from "./ConfirmDialog";
import { EntryActions } from "./EntryActions";
import { EntryForm } from "./EntryForm";

const KIND_LABEL = { note: "Note", symptom: "Symptom", event: "Event", vital: "Vitals" } as const;
const KIND_BADGE = {
  note: "badge-ghost",
  symptom: "badge-warning",
  event: "badge-info",
  vital: "badge-success",
} as const;

export function TimelineEntryCard({
  entry,
  authorName,
  canWrite,
  units,
}: {
  entry: TimelineEntry;
  authorName: string;
  canWrite: boolean;
  units: UnitChoices;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const remover = useFetcher();
  const stopEditing = useCallback(() => setEditing(false), []);

  const removing = remover.state !== "idle";
  const elsewhere = formatTimeInZone(entry.occurredAt, entry.timeZone);
  const symptom = isSymptomDetails(entry.details) ? entry.details : undefined;
  const readings = isVitalDetails(entry.details) ? entry.details.readings.filter(isKnownReading) : [];
  const heading = entry.kind === "symptom" ? symptom?.name : entry.title;

  if (editing) {
    return (
      <li className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h3 className="font-semibold">Edit {KIND_LABEL[entry.kind].toLowerCase()}</h3>
          <EntryForm entry={entry} units={units} onDone={stopEditing} onCancel={stopEditing} />
        </div>
      </li>
    );
  }

  return (
    <li className={`card bg-base-100 shadow-sm ${removing ? "opacity-50" : ""}`}>
      <div className="card-body gap-1 p-4">
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`badge badge-sm ${KIND_BADGE[entry.kind]}`}>{KIND_LABEL[entry.kind]}</span>
            <time dateTime={entry.occurredAt} className="text-sm font-medium">
              {formatTime(entry.occurredAt)}
            </time>
            {elsewhere && <span className="text-base-content/60 text-xs">({elsewhere})</span>}
          </div>
          {canWrite && <EntryActions onEdit={() => setEditing(true)} onDelete={() => setConfirming(true)} />}
        </div>

        {heading && (
          <h3 className="font-semibold">
            {heading}
            {symptom?.severity != null && (
              <span className="text-base-content/70 font-normal">
                {" "}
                · severity {symptom.severity}/{TIMELINE_LIMITS.severityMax}
              </span>
            )}
          </h3>
        )}
        {readings.length > 0 && (
          <ul className="flex flex-wrap gap-x-3 gap-y-1 font-semibold tabular-nums">
            {readings.map((r) => (
              <li key={r.type}>{formatReading(r, units)}</li>
            ))}
          </ul>
        )}
        {entry.body && <p className="whitespace-pre-wrap">{entry.body}</p>}
        <p className="text-base-content/60 text-xs">{authorName}</p>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Delete this entry?"
        confirmLabel="Delete"
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void remover.submit({ intent: "remove", id: entry.id }, { method: "post" });
        }}
      />
    </li>
  );
}
