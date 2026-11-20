import type { PeriodSpan } from "@caretook/data/schema";
import type { LocalCarePeriod } from "~/lib/care-periods/carePeriods.sync";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { periodTitle } from "~/lib/care-periods/periodDisplay";
import { neighbourLabel, spanDatesText } from "./periodPage";

type Span = PeriodSpan<LocalCarePeriod>;

function NeighbourLink({
  groupId,
  which,
  span,
  timeZone,
  now,
}: {
  groupId: string;
  which: "previous" | "next";
  span: Span;
  timeZone: string;
  now: Date;
}) {
  const Icon = which === "previous" ? ChevronLeft : ChevronRight;
  return (
    <Link
      to={appUrls.period(groupId, span.period.id)}
      aria-label={neighbourLabel(which, span, timeZone, now)}
      className={`rounded-box border-base-300 hover:bg-base-200/50 flex min-w-0 flex-1 items-center gap-2 border px-3 py-2 ${which === "next" ? "flex-row-reverse text-right" : ""}`}
      data-period-neighbour={which}
    >
      <Icon className="text-base-content/70 size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        <span className="text-base-content/70 block text-xs">
          {which === "previous" ? "Before" : "After"}
        </span>
        <span className="block truncate font-medium">{periodTitle(span.period)}</span>
        <span className="text-base-content/70 block text-sm">{spanDatesText(span, timeZone, now)}</span>
      </span>
    </Link>
  );
}

/** Links to the periods before and after this one on the track, to step through the history. */
export function PeriodNeighbours({
  groupId,
  previous,
  next,
  timeZone,
  now,
}: {
  groupId: string;
  previous: Span | null;
  next: Span | null;
  timeZone: string;
  now: Date;
}) {
  if (!previous && !next) return null;
  return (
    <nav aria-label="Other care periods" className="flex gap-2" data-period-neighbours>
      {previous ? (
        <NeighbourLink groupId={groupId} which="previous" span={previous} timeZone={timeZone} now={now} />
      ) : (
        <span className="flex-1" />
      )}
      {next ? (
        <NeighbourLink groupId={groupId} which="next" span={next} timeZone={timeZone} now={now} />
      ) : (
        <span className="flex-1" />
      )}
    </nav>
  );
}
