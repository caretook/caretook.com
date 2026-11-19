import type { UnitChoices } from "@caretook/data/schema";
import type { ReactNode } from "react";
import type { LinkedProviderName } from "~/lib/entryProviders";
import type { TimelineEntry } from "~/lib/rpc";

import { useEffect, useRef, useState } from "react";
import { entrySummary, KIND_META } from "~/lib/entryDisplay";
import { chipLabel, withSummary, withText } from "~/lib/entryProviders";
import { medicationEntryText } from "~/lib/medicationEntries";
import { MedicationHeading } from "./MedicationEntryText";

/** Readable lines on wide screens: the heading, the "with …" line and the text stop at about 75 characters. */
const TEXT_CAP = "max-w-[75ch]";

/**
 * What an entry says, the same in rows and cards: the kind (for screen
 * readers), then its heading (title or symptom name, with severity; a dose's
 * or change's medication and what happened), its vital readings, who it was
 * with (linked providers), a dose's or stop's note, and its text, in that order. The first of those can share a line
 * with `aside` (the card's live dot and time); `footer` comes last. Rows clamp
 * the text to two lines (`clamp`, with "More"); cards show all of it.
 */
export function EntryBody({
  entry,
  units,
  clamp = false,
  providers,
  aside,
  footer,
  className = "",
}: {
  entry: TimelineEntry;
  units: UnitChoices;
  clamp?: boolean;
  providers?: readonly LinkedProviderName[];
  aside?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const { heading, severity, readings, body } = entrySummary(entry, units);
  const medication = medicationEntryText(entry);
  const [lead, ...rest] = [
    medication && (
      <MedicationHeading key="medication" entry={entry} what={medication.what} className={TEXT_CAP} />
    ),
    heading && (
      <p key="heading" className={`font-semibold break-words ${TEXT_CAP}`}>
        {heading}
        {severity && <span className="text-base-content/70 font-normal"> · {severity}</span>}
      </p>
    ),
    readings.length > 0 && <Readings key="readings" readings={readings} />,
    providers && providers.length > 0 && <WithLine key="with" providers={providers} />,
    medication?.note && (
      <p key="note" className={`text-base-content/80 break-words ${TEXT_CAP}`} data-medication-note>
        {medication.note}
      </p>
    ),
    body && (clamp ? <ClampedText key="body" text={body} /> : <FullText key="body" text={body} />),
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
function Readings({ readings }: { readings: string[] }) {
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

/**
 * "with Dr. A, Dr. B +1": up to two names, a removed provider greyed with
 * "(removed)". Text only (no links), so a tap still reaches the row's open
 * target; screen readers get the sentence ("… and 1 more").
 */
function WithLine({ providers }: { providers: readonly LinkedProviderName[] }) {
  const { names, more } = withSummary(providers);
  return (
    <p className={`text-base-content/70 text-sm break-words ${TEXT_CAP}`} data-with>
      <span className="sr-only">{withText(providers)}</span>
      <span aria-hidden="true">
        with{" "}
        {names.map((p, i) => (
          <span key={p.id}>
            {i > 0 && ", "}
            <span data-with-name={p.id} className={p.deletedAt ? "text-base-content/50" : undefined}>
              {chipLabel(p)}
            </span>
          </span>
        ))}
        {more > 0 && <span data-with-more> +{more}</span>}
      </span>
    </p>
  );
}

function FullText({ text }: { text: string }) {
  return <p className={`break-words whitespace-pre-wrap ${TEXT_CAP}`}>{text}</p>;
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
        className={`text-base-content/90 break-words whitespace-pre-wrap ${TEXT_CAP} ${expanded ? "" : "line-clamp-2"}`}
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
