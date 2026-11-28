import type { UnitChoices } from "@caretook/data/schema";
import type { ReactNode } from "react";
import type { LinkedProviderName } from "~/lib/providers/entryProviders";
import type { TimelineEntry } from "~/lib/core/rpc";
import type { NoteBlock } from "~/lib/live-notes/noteRichText";

import { conditionChangeText, isConditionChangeDetails } from "@caretook/data/schema";
import { useEffect, useRef, useState } from "react";
import { Highlight } from "~/components/ui";
import { entrySummary, KIND_META } from "~/lib/timeline/entryDisplay";
import { isLiveEntryKind } from "~/lib/live-notes/liveEntry";
import { chipLabel, withSummary, withText } from "~/lib/providers/entryProviders";
import { medicationEntryText } from "~/lib/medications/medicationEntries";
import { MedicationHeading } from "./MedicationEntryText";
import { NoteRichText } from "./NoteRichText";
import type { HighlightRange, ParsedSearch } from "@caretook/data/domain";
import { highlightRanges, snippetIfHidden } from "@caretook/data/domain";

/** Readable lines on wide screens: the heading, the "with …" line and the text stop at about 75 characters. */
const TEXT_CAP = "max-w-[75ch]";

/**
 * What an entry says, the same in rows and cards: the kind (for screen
 * readers), then its heading (title or symptom name, with severity; a dose's
 * or change's medication and what happened; a condition change's "Added
 * Type 2 diabetes" and its before → after lines), its vital readings, who it was
 * with (linked providers), a dose's or stop's note, and its text, in that order. The first of those can share a line
 * with `aside` (the card's live dot and time); `footer` comes last. Rows clamp
 * the text to two lines (`clamp`, with "More"); cards show all of it, a
 * note's or event's with its formatting when given its `richText`.
 *
 * With `search` (a parsed `?q=`), matched words are marked, and a clamped
 * note's or event's text whose match is past the clamp gets a snippet line
 * around it (`snippetIfHidden`).
 */
export function EntryBody({
  entry,
  units,
  clamp = false,
  providers,
  richText,
  aside,
  footer,
  search,
  className = "",
}: {
  entry: TimelineEntry;
  units: UnitChoices;
  clamp?: boolean;
  providers?: readonly LinkedProviderName[];
  /** A note's or event's document blocks (`noteRichText`): shown formatted unless clamped. */
  richText?: readonly NoteBlock[] | null;
  aside?: ReactNode;
  footer?: ReactNode;
  /** The search to mark (the timeline's or the search page's `q`, parsed). */
  search?: ParsedSearch;
  className?: string;
}) {
  const { heading, severity, readings, body } = entrySummary(entry, units);
  const medication = medicationEntryText(entry);
  const condition =
    entry.kind === "conditionChange" && isConditionChangeDetails(entry.details)
      ? conditionChangeText(entry.details)
      : null;
  const marks = (text: string) => (search ? highlightRanges(text, search) : undefined);
  const snippet =
    search && clamp && body && isLiveEntryKind(entry.kind) ? snippetIfHidden(body, search) : null;
  const [lead, ...rest] = [
    medication && (
      <MedicationHeading
        key="medication"
        entry={entry}
        what={medication.what}
        standalone={medication.standalone}
        search={search}
        className={TEXT_CAP}
      />
    ),
    condition && (
      <p key="condition" className={`font-semibold break-words ${TEXT_CAP}`} data-condition-entry>
        <Highlight text={condition.heading} ranges={marks(condition.heading)} />
      </p>
    ),
    ...(condition?.lines ?? []).map((line) => (
      <p key={`condition-${line}`} className={`break-words ${TEXT_CAP}`} data-condition-change>
        <Highlight text={line} ranges={marks(line)} />
      </p>
    )),
    heading && (
      <p key="heading" className={`font-semibold break-words ${TEXT_CAP}`}>
        <Highlight text={heading} ranges={marks(heading)} />
        {severity && <span className="text-muted font-normal"> · {severity}</span>}
      </p>
    ),
    readings.length > 0 && <Readings key="readings" readings={readings} marks={marks} />,
    providers && providers.length > 0 && <WithLine key="with" providers={providers} marks={marks} />,
    medication?.note && (
      <p key="note" className={`text-muted break-words ${TEXT_CAP}`} data-medication-note>
        <Highlight text={medication.note} ranges={marks(medication.note)} />
      </p>
    ),
    body &&
      (clamp ? (
        <ClampedText key="body" text={body} ranges={marks(body)} />
      ) : richText?.length && isLiveEntryKind(entry.kind) ? (
        <NoteRichText key="body" blocks={richText} marks={marks} className={`break-words ${TEXT_CAP}`} />
      ) : (
        <FullText key="body" text={body} ranges={marks(body)} />
      )),
    snippet && (
      <p key="snippet" className={`text-muted text-sm break-words ${TEXT_CAP}`} data-snippet>
        <Highlight text={snippet.text} ranges={snippet.ranges} />
      </p>
    ),
  ].filter(Boolean);

  return (
    <div className={`min-w-0 flex-1 ${className}`}>
      <span className="sr-only">{KIND_META[entry.kind].label}: </span>
      {aside ? (
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0 break-words">{lead}</div>
          <span className="flex shrink-0 items-center gap-2">{aside}</span>
        </div>
      ) : (
        lead
      )}
      {rest}
      {footer}
    </div>
  );
}

/** Vital readings as a wrapping list: each reading stays on one line. */
type Marks = (text: string) => HighlightRange[] | undefined;

function Readings({ readings, marks }: { readings: string[]; marks: Marks }) {
  return (
    <ul className="flex flex-wrap gap-x-3 font-semibold tabular-nums">
      {readings.map((r) => (
        <li key={r} className="whitespace-nowrap">
          <Highlight text={r} ranges={marks(r)} />
        </li>
      ))}
    </ul>
  );
}

/**
 * "with Dr. A, Dr. B +1": up to two names, a removed provider greyed with
 * "(removed)". Text only (no links), so a tap still reaches the row's open
 * target; screen readers get the sentence ("… and 1 more").
 */
function WithLine({ providers, marks }: { providers: readonly LinkedProviderName[]; marks: Marks }) {
  const { names, more } = withSummary(providers);
  return (
    <p className={`text-muted text-sm break-words ${TEXT_CAP}`} data-with>
      <span className="sr-only">{withText(providers)}</span>
      <span aria-hidden="true">
        with{" "}
        {names.map((p, i) => (
          <span key={p.id}>
            {i > 0 && ", "}
            <span data-with-name={p.id} className={p.deletedAt ? "text-faint" : undefined}>
              <Highlight text={chipLabel(p)} ranges={marks(chipLabel(p))} />
            </span>
          </span>
        ))}
        {more > 0 && <span data-with-more> +{more}</span>}
      </span>
    </p>
  );
}

function FullText({ text, ranges }: { text: string; ranges?: HighlightRange[] }) {
  return (
    <p className={`break-words whitespace-pre-wrap ${TEXT_CAP}`}>
      <Highlight text={text} ranges={ranges} />
    </p>
  );
}

/** Text clamped to two lines, with a "More" toggle only when it overflows. */
function ClampedText({ text, ranges }: { text: string; ranges?: HighlightRange[] }) {
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
        className={`break-words whitespace-pre-wrap ${TEXT_CAP} ${expanded ? "" : "line-clamp-2"}`}
      >
        <Highlight text={text} ranges={ranges} />
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          className="link link-hover text-muted relative z-10 text-sm"
          aria-expanded={expanded}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "Less" : "More"}
        </button>
      )}
    </>
  );
}
