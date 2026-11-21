import type { DaySummaryMode } from "@caretook/data/schema";
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
 * One day's summary, inside its sticky header under the date (`DayHeader`'s
 * `summary`), so it stays pinned while the day scrolls by: one line, clipped
 * when it's too long, that is also a disclosure button (named by
 * `summaryLabel`, so the whole summary is read, arrows in words); tapped (or
 * Enter/Space), the summary's lines show below it, one per kind of thing.
 * Parts are bare text inside their line (no element per part), so an
 * event's title never matches on its own. The expanded state isn't
 * remembered. `mode` (the viewer's setting) picks the line: `highlights`
 * shows only what stands out, `full` everything; the expanded lines are
 * always the full breakdown. Nothing for a day with nothing to show in the
 * mode (the caller renders nothing at all when it's `off`).
 */
export function DaySummaryLine({
  summary,
  mode = "highlights",
}: {
  summary: DaySummary | undefined;
  mode?: Exclude<DaySummaryMode, "off">;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const parts = mode === "full" ? summary?.parts : summary?.highlights;
  if (!summary || !parts?.length) return null;

  return (
    <div className="pt-0.5" data-day-summary>
      <button
        type="button"
        className="text-base-content/75 hover:text-base-content flex w-full min-w-0 cursor-pointer items-center gap-1 rounded text-left text-sm"
        aria-expanded={expanded}
        aria-controls={id}
        aria-label={`Day summary: ${summaryLabel(parts)}`}
        onClick={() => setExpanded((e) => !e)}
      >
        <ChevronRight aria-hidden="true" className={`size-4 shrink-0 ${expanded ? "rotate-90" : ""}`} />
        <span className="min-w-0 flex-1 truncate">
          {parts.map((part, i) => (
            <Fragment key={i}>
              {i > 0 && " · "}
              {part.text}
              {part.direction && ` ${ARROW[part.direction]}`}
            </Fragment>
          ))}
        </span>
      </button>
      <ul id={id} hidden={!expanded} className="text-base-content/80 mt-1 space-y-0.5 pl-5 text-sm">
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
