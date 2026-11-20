import type { UpcomingDose } from "~/lib/upcomingDoses";

import { Link } from "react-router";
import { KindIcon } from "~/components/entry";
import { appUrls } from "~/lib/appUrls";
import { SHEET_LINK_STATE } from "~/lib/timelineSheet";
import { doseItemText, doseLinkLabel, doseStateLabel } from "~/lib/upcomingDoses";
import { timeRange } from "~/lib/upcomingLabels";

/**
 * One of today's open passes in Upcoming, one row each: the dose icon, its
 * time (where the viewer is, like the rows around it), "Morning · 3
 * medications" (or, for a time of its own, "Metformin 500 mg dose") and its
 * state ("Due", "Overdue"). For writers the row opens the Dose sheet on that
 * pass (Given all), or on that medication and slot, over the timeline;
 * closing it comes back here. Viewers see it without a link. It's never an
 * entry: logging answers it.
 */
export function UpcomingDoseRow({
  dose,
  groupId,
  canWrite,
}: {
  dose: UpcomingDose;
  groupId: string;
  canWrite: boolean;
}) {
  const when = timeRange({ id: dose.key, occurredAt: dose.at, timeZone: "UTC" });
  const state = doseStateLabel(dose.state);
  return (
    <li
      className="relative isolate flex items-start gap-2.5 px-3 py-2"
      data-upcoming-dose={dose.key}
      data-slot-state={dose.state}
    >
      {canWrite && (
        <Link
          to={
            dose.passId
              ? appUrls.newDose(groupId, { passId: dose.passId })
              : appUrls.newDose(groupId, { medicationId: dose.medicationId ?? undefined, slot: dose.time })
          }
          state={SHEET_LINK_STATE}
          prefetch="render"
          className="hover:bg-base-content/5 focus-visible:outline-primary absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:-outline-offset-2 focus-visible:outline-2"
          aria-label={doseLinkLabel(dose, when)}
        />
      )}
      <KindIcon kind="dose" size="sm" />
      <time
        dateTime={dose.at}
        className="text-base-content/70 w-[5.5rem] shrink-0 pt-0.5 text-sm tabular-nums"
        data-when
      >
        {when}
      </time>
      <p className="min-w-0 flex-1 pt-0.5 font-medium">
        {doseItemText(dose)}
        {state && (
          <>
            {" "}
            <span
              className={`badge badge-sm badge-soft ${dose.state === "overdue" ? "badge-error" : "badge-warning"}`}
              data-dose-state
            >
              {state}
            </span>
          </>
        )}
      </p>
    </li>
  );
}
