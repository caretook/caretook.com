import type { DaySummary, SummaryPart } from "./daySummary";

import { ChevronRight } from "lucide-react";
import { Fragment, useId, useState } from "react";
import { ARROW, summaryLabel } from "./daySummary";

/** A part's text, its arrow shown but read in words ("higher than last week"). */
function PartText({ part }: { part: SummaryPart }) {
  return (
    <>
      {part.text}
      {part.direction && (
        <>
          {" "}
          <span aria-hidden="true" className="font-semibold">
            {ARROW[part.direction]}
          </span>
          <span className="sr-only">({part.directionLabel})</span>
        </>
      )}
    </>
  );
}

/**
 * One day's summary, under its sticky heading (never inside it): one line,
 * clipped when it's too long, that is also a disclosure button (named by
 * `summaryLabel`, so the whole summary is read, arrows in words); tapped (or
 * Enter/Space), the summary's lines show below it, one per kind of thing.
 * Parts are bare text inside their line (no element per part), so an
 * event's title never matches on its own. The expanded state isn't
 * remembered. Nothing for a day with nothing to sum up.
 */
export function DaySummaryLine({ summary }: { summary: DaySummary | undefined }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  if (!summary?.parts.length) return null;

  return (
    <div className="px-1 pb-1.5" data-day-summary>
      <button
        type="button"
        className="text-base-content/75 hover:text-base-content flex w-full min-w-0 cursor-pointer items-center gap-1 rounded text-left text-sm"
        aria-expanded={expanded}
        aria-controls={id}
        aria-label={`Day summary: ${summaryLabel(summary.parts)}`}
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="min-w-0 flex-1 truncate">
          {summary.parts.map((part, i) => (
            <Fragment key={i}>
              {i > 0 && " · "}
              {part.text}
              {part.direction && ` ${ARROW[part.direction]}`}
            </Fragment>
          ))}
        </span>
        <ChevronRight aria-hidden="true" className={`size-4 shrink-0 ${expanded ? "rotate-90" : ""}`} />
      </button>
      <ul id={id} hidden={!expanded} className="text-base-content/80 mt-1 space-y-0.5 text-sm">
        {summary.lines.map((line) => (
          <li key={line.label}>
            <span className="text-base-content/60">{line.label}:</span>{" "}
            {line.parts.map((part, i) => (
              <Fragment key={i}>
                {i > 0 && ", "}
                <PartText part={part} />
              </Fragment>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
