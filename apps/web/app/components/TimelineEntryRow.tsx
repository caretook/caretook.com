import type { UnitChoices } from "@caretook/data/schema";
import type { TimelineEntry } from "~/lib/rpc";

import { useEffect, useRef, useState } from "react";
import { entrySummary, initials, KIND_META } from "~/lib/entryDisplay";
import { formatTime, formatTimeInZone } from "~/lib/format";
import { EntryActions } from "./EntryActions";
import { AuthorInitials, KindIcon } from "./KindIcon";

export type EntryViewProps = {
  entry: TimelineEntry;
  authorName: string;
  units: UnitChoices;
  /** Fading out while its delete is saved. */
  removing?: boolean;
  /** Omitted for people who can't change the timeline (viewers). */
  onEdit?: () => void;
  onDelete?: () => void;
};

/** Screen-reader name for an entry's ⋯ menu. */
export const actionsLabel = (entry: TimelineEntry) =>
  `Actions for ${KIND_META[entry.kind].label.toLowerCase()} at ${formatTime(entry.occurredAt)}`;

/**
 * One entry as a dense row: kind icon, time, a one-line summary, author
 * initials and the ⋯ menu. Long text is clamped to two lines, with "More".
 */
export function TimelineEntryRow({ entry, authorName, units, removing, onEdit, onDelete }: EntryViewProps) {
  const { heading, severity, readings, body } = entrySummary(entry, units);
  const elsewhere = formatTimeInZone(entry.occurredAt, entry.timeZone);

  return (
    <li className={`flex items-start gap-2.5 px-3 py-2 ${removing ? "opacity-50" : ""}`}>
      <KindIcon kind={entry.kind} size="sm" />
      <time
        dateTime={entry.occurredAt}
        className="text-base-content/70 w-[4.1rem] shrink-0 pt-0.5 text-sm whitespace-nowrap tabular-nums"
      >
        {formatTime(entry.occurredAt)}
      </time>
      <div className="min-w-0 flex-1 pt-0.5">
        <span className="sr-only">{KIND_META[entry.kind].label}: </span>
        {heading && (
          <p className="font-semibold break-words">
            {heading}
            {severity && <span className="text-base-content/70 font-normal"> · {severity}</span>}
          </p>
        )}
        {readings.length > 0 && <Readings readings={readings} />}
        {body && <ClampedText text={body} />}
        {elsewhere && <p className="text-base-content/60 text-xs">{elsewhere}</p>}
      </div>
      <AuthorInitials name={authorName} initials={initials(authorName)} />
      {onEdit && onDelete && <EntryActions label={actionsLabel(entry)} onEdit={onEdit} onDelete={onDelete} />}
    </li>
  );
}

/** Vital readings as a wrapping list: each reading stays on one line. */
export function Readings({ readings }: { readings: string[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 font-semibold tabular-nums">
      {readings.map((r) => (
        <li key={r} className="whitespace-nowrap">
          {r}
        </li>
      ))}
    </ul>
  );
}

/** Text clamped to two lines, with a "More" toggle only when it overflows. */
function ClampedText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  return (
    <>
      <p
        ref={ref}
        className={`text-base-content/90 break-words whitespace-pre-wrap ${expanded ? "" : "line-clamp-2"}`}
      >
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          className="link link-hover text-base-content/70 text-sm"
          aria-expanded={expanded}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "Less" : "More"}
        </button>
      )}
    </>
  );
}
