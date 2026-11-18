import type { UnitChoices } from "@caretook/data/schema";
import type { TimelineEntry } from "~/lib/rpc";

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { entrySummary, initials, KIND_META } from "~/lib/entryDisplay";
import { formatTime, formatTimeInZone } from "~/lib/format";
import { EntryActions } from "./EntryActions";
import { AuthorInitials, KindFilterLink } from "~/components/KindIcon";
import { LiveDot } from "./LiveDot";

export type EntryViewProps = {
  entry: TimelineEntry;
  authorName: string;
  units: UnitChoices;
  /** Fading out while its delete is saved. */
  removing?: boolean;
  /**
   * What tapping the row does: a note or event opens its page (for everyone),
   * a symptom or vital opens its edit sheet (writers only). Omitted: nothing.
   */
  open?: EntryOpen;
  /** The ⋯ menu's Edit, for symptoms and vitals. */
  onEdit?: () => void;
  /** Omitted for people who can't change the timeline (viewers): no ⋯ menu. */
  onDelete?: () => void;
  /** Others are writing in its document now: the live dot's label ("Being written now by Maria"). */
  liveLabel?: string;
};

/**
 * A link: a note's or event's page, or (`edit`) a symptom's or vital's edit
 * sheet, which carries `state` and keeps the scroll position.
 */
export type EntryOpen = { to: string; edit?: boolean; state?: object };

/**
 * The whole row's tap target: a link stretched over the row, so
 * it's one focusable, named control for keyboards and screen readers. The
 * kind icon, the ⋯ button and the More/Less toggle sit above it (`relative z-10`), so taps on
 * them don't open the entry. The row itself must be `relative isolate` (its own stacking context, so
 * those don't rise above the sticky day headers).
 */
export function EntryOpenTarget({ open, entry }: { open: EntryOpen; entry: TimelineEntry }) {
  const className =
    "absolute inset-0 cursor-pointer rounded-[inherit] hover:bg-base-content/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary";
  return (
    <Link
      to={open.to}
      state={open.state}
      preventScrollReset={open.edit}
      className={className}
      aria-label={`${open.edit ? "Edit" : "Open"} ${entryLabel(entry)}`}
    />
  );
}

/** A short name for the entry, for links and labels. */
export const entryLabel = (entry: TimelineEntry) =>
  `${entry.title || KIND_META[entry.kind].label.toLowerCase()} at ${formatTime(entry.occurredAt)}`;

/** Screen-reader name for an entry's ⋯ menu. */
export const actionsLabel = (entry: TimelineEntry) =>
  `Actions for ${KIND_META[entry.kind].label.toLowerCase()} at ${formatTime(entry.occurredAt)}`;

/**
 * One entry as a dense row: kind icon, time, a one-line summary, author
 * initials and the ⋯ menu. Long text is clamped to two lines, with "More".
 */
export function TimelineEntryRow({
  entry,
  authorName,
  units,
  removing,
  open,
  onEdit,
  onDelete,
  liveLabel,
}: EntryViewProps) {
  const { heading, severity, readings, body } = entrySummary(entry, units);
  const elsewhere = formatTimeInZone(entry.occurredAt, entry.timeZone);

  return (
    <li className={`relative isolate flex items-start gap-2.5 px-3 py-2 ${removing ? "opacity-50" : ""}`}>
      {open && <EntryOpenTarget open={open} entry={entry} />}
      <KindFilterLink kind={entry.kind} size="sm" />
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
      {liveLabel && <LiveDot label={liveLabel} className="mt-2" />}
      <AuthorInitials name={authorName} initials={initials(authorName)} />
      {onDelete && <EntryActions label={actionsLabel(entry)} onEdit={onEdit} onDelete={onDelete} />}
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
          className="link link-hover text-base-content/70 relative z-10 text-sm"
          aria-expanded={expanded}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "Less" : "More"}
        </button>
      )}
    </>
  );
}
