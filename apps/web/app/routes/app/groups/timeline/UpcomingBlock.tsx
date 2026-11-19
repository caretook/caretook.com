import type { ReactNode } from "react";
import type { TimelineView } from "@caretook/data/schema";
import type { TimelineEntry } from "~/lib/rpc";
import type { TimelineData } from "./useTimelineData";

import { ArrowRight, CalendarClock } from "lucide-react";
import { Link } from "react-router";
import { STRIP_ICON } from "./layout";

/**
 * The Upcoming block above Today (`?upcoming=1`): the first upcoming items
 * under the timeline's filters, soonest first, by day ("Now", "Today",
 * "Tomorrow", "Friday, Nov 27"), in the timeline's own rows or cards
 * (`entry` renders one), then "See all in Upcoming".
 */
export function UpcomingBlock({
  upcoming,
  view,
  listClass,
  seeAll,
  entry,
}: {
  upcoming: TimelineData["upcoming"];
  view: TimelineView;
  /** The list's look in this view (the timeline's own). */
  listClass: string;
  /** Upcoming, with the timeline's filters. */
  seeAll: string;
  entry: (entry: TimelineEntry) => ReactNode;
}) {
  const shown = upcoming.sections.reduce((n, s) => n + s.items.length, 0);
  return (
    <section aria-labelledby="upcoming-block-heading" className="space-y-2" data-upcoming-block>
      <h2 id="upcoming-block-heading" className="flex items-center gap-2 text-base font-semibold lg:text-lg">
        <CalendarClock className={`${STRIP_ICON} text-base-content/70`} aria-hidden="true" />
        Upcoming
      </h2>
      {upcoming.sections.length === 0 && (
        <p className="text-base-content/70 text-sm" data-empty>
          Nothing upcoming.
        </p>
      )}
      {upcoming.sections.map((section) => (
        <section
          key={section.key}
          aria-labelledby={`upcoming-day-${section.key}`}
          data-upcoming-day={section.key}
        >
          <h3 id={`upcoming-day-${section.key}`} className="text-base-content/70 py-1 text-sm font-semibold">
            {section.label}
          </h3>
          <ol className={listClass} data-block-view={view}>
            {section.items.map(entry)}
          </ol>
        </section>
      ))}
      <Link to={seeAll} className="link link-hover inline-flex items-center gap-1 text-sm" data-see-all>
        {upcoming.total > shown ? `See all ${upcoming.total} in Upcoming` : "See all in Upcoming"}
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </section>
  );
}
