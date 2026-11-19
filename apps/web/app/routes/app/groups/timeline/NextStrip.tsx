import type { TimelineData } from "./useTimelineData";

import { CalendarClock } from "lucide-react";
import { Link, useLocation } from "react-router";
import { appUrls } from "~/lib/appUrls";
import { clearUpcoming, setUpcoming } from "~/lib/timelineFilters";
import { nextStripText, upcomingTitle } from "~/lib/upcomingLabels";

/**
 * "Next: Dr. Alvarez · Tomorrow 10:30 AM · +3 more": the group's next
 * appointment or reminder (never a cancelled one), linking to it, with
 * "Show upcoming" beside it, which adds the Upcoming block above Today
 * (`?upcoming=1`, kept with the filters). Viewers too. Hidden when nothing
 * is upcoming, unless the block is on (then it says so, and can hide it).
 */
export function NextStrip({
  next,
  now,
  groupId,
  showing,
}: {
  next: TimelineData["next"];
  now: Date;
  groupId: string;
  /** The Upcoming block is on. */
  showing: boolean;
}) {
  const { search } = useLocation();
  const text = nextStripText(next, now);
  if (!text && !showing) return null;

  return (
    <section
      aria-label="Next up"
      data-next-strip
      className="rounded-box border-base-300 bg-base-100 flex items-center gap-2.5 border px-3 py-1.5"
    >
      <CalendarClock className="text-base-content/70 size-4 shrink-0" aria-hidden="true" />
      {next.next && text ? (
        <Link
          to={appUrls.entry(groupId, next.next.id)}
          className="link-hover min-w-0 flex-1 text-sm break-words"
          aria-label={`${text}: open ${upcomingTitle(next.next)}`}
          data-next={next.next.id}
        >
          {text}
        </Link>
      ) : (
        <p className="text-base-content/70 min-w-0 flex-1 text-sm">Nothing upcoming</p>
      )}
      <Link
        to={{ search: showing ? clearUpcoming(search) : setUpcoming(search) }}
        replace
        preventScrollReset
        className="btn btn-ghost btn-sm shrink-0"
        data-upcoming-toggle={showing ? "on" : "off"}
      >
        {showing ? "Hide upcoming" : "Show upcoming"}
      </Link>
    </section>
  );
}
