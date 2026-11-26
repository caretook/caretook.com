import type { UnitChoices } from "@caretook/data/schema";
import type { ReactNode } from "react";
import type { TimelineEntry } from "~/lib/core/rpc";
import type { LinkedContact } from "./upcomingContact";
import type { RescheduledTarget } from "./useUpcomingData";

import { Link } from "react-router";
import { EntryBody, KindFilterLink, KindIcon, RepeatMark } from "~/components/entry";
import { Badge, LINK, STATUS_TONE } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { entryTiming } from "~/lib/appointments/upcoming";
import { plannerReturnState } from "~/lib/appointments/plannerReturn";
import {
  cancelledLabel,
  nowLabel,
  rescheduledLabel,
  timeRange,
  upcomingTitle,
} from "~/lib/appointments/upcomingLabels";
import { placeLine, placeOf, upcomingActions } from "./upcomingContact";
import { UpcomingRowActions, UpcomingRowAuthor } from "./UpcomingRowParts";
import { usePlannerOpener } from "./usePlannerOpener";

/**
 * One upcoming (or past) item as a card: the kind icon (a filter) on the left
 * and, for writers, the ⋯ menu (`menu`) on the right. Between them its time on
 * one line ("10:30 AM–11:15 AM", "All day", or "Now · until 11:15 AM") with the
 * repeat mark, the entry's body with its "with …" line, its place, and
 * "Cancelled" (struck through). A footer holds labelled Call and Directions on
 * the left and the author's avatar (a filter) on the right; a card with no
 * actions has no footer, and its avatar ends the last line, under the menu.
 * The whole row opens the entry's page, which goes back to this tab (its
 * filters too: `plannerReturn` in history state, B-690). `readOnly` (the easy roles' Planner)
 * shows the kind and avatar without their filter links, so a tap on the
 * avatar opens the row.
 */
export function UpcomingRow({
  entry,
  groupId,
  now,
  units,
  authorName,
  authorImage,
  contacts,
  rescheduledTo,
  menu,
  tags,
  readOnly = false,
}: {
  entry: TimelineEntry;
  groupId: string;
  now: Date;
  units: UnitChoices;
  authorName: string;
  authorImage: string | null;
  contacts?: LinkedContact[];
  /** A cancelled event's new one, when it was rescheduled and that's on the device. */
  rescheduledTo?: RescheduledTarget;
  /** The entry's ⋯ menu (Print for viewers; more for writers). */
  menu?: ReactNode;
  /** Its tags' chips (tags PRD). */
  tags?: ReactNode;
  /** No filter links (the easy roles' Planner has no filters). */
  readOnly?: boolean;
}) {
  const cancelled = cancelledLabel(entry);
  // A cancelled item isn't happening, so it's never "Now".
  const inProgress = !cancelled && entryTiming(entry, now) === "now";
  const when = inProgress ? nowLabel(entry) : timeRange(entry);
  const place = placeOf(entry, contacts);
  const actions = upcomingActions(entry, contacts);
  const opened = plannerReturnState(usePlannerOpener(false));

  const hasFooter = actions.length > 0;
  const hasSide = Boolean(menu) || !hasFooter;
  const author = (
    <UpcomingRowAuthor userId={entry.createdBy} name={authorName} image={authorImage} readOnly={readOnly} />
  );

  return (
    <li
      className={`relative isolate grid gap-x-2.5 gap-y-1 px-3 py-2 ${hasSide ? "grid-cols-[auto_minmax(0,1fr)_auto]" : "grid-cols-[auto_minmax(0,1fr)]"}`}
      data-upcoming-item={entry.id}
      data-cancelled={cancelled ? "" : undefined}
    >
      <Link
        to={appUrls.entry(groupId, entry.id)}
        state={opened}
        className="hover:bg-base-content/5 focus-visible:outline-primary absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:-outline-offset-2 focus-visible:outline-2"
        aria-label={`Open ${upcomingTitle(entry)}, ${when}${cancelled ? `, ${cancelled.toLowerCase()}` : ""}`}
      />
      {readOnly ? <KindIcon kind={entry.kind} size="sm" /> : <KindFilterLink kind={entry.kind} size="sm" />}
      <div className="min-w-0">
        <p
          className={`flex items-center gap-1 text-sm whitespace-nowrap tabular-nums ${inProgress ? "text-primary-ink font-semibold" : "text-muted"}`}
          data-when-line
        >
          <time dateTime={entry.occurredAt} data-when>
            {when}
          </time>
          {entry.seriesId && <RepeatMark seriesId={entry.seriesId} />}
        </p>
        <EntryBody
          entry={entry}
          units={units}
          clamp
          providers={contacts}
          className={cancelled ? "text-faint line-through" : ""}
        />
        {place && (
          <p className="text-muted text-sm break-words" data-place>
            {placeLine(place.text)}
            {place.from && <span className="text-faint"> · from {place.from}</span>}
          </p>
        )}
        {tags}
        {cancelled && (
          <p className="text-sm" data-cancelled-label>
            <Badge tone={STATUS_TONE.past}>{cancelled}</Badge>
            {rescheduledTo && (
              <>
                {" · "}
                <Link
                  to={appUrls.entry(groupId, rescheduledTo.id)}
                  state={opened}
                  className={`${LINK} relative z-10`}
                  data-rescheduled-to={rescheduledTo.id}
                >
                  {rescheduledLabel(rescheduledTo)}
                </Link>
              </>
            )}
          </p>
        )}
      </div>
      {hasSide && (
        <div className="flex flex-col items-end gap-1">
          {menu}
          {!hasFooter && <div className="mt-auto flex">{author}</div>}
        </div>
      )}
      {hasFooter && (
        <div className="col-start-2 col-end-[-1] flex items-center justify-between gap-2" data-row-footer>
          <UpcomingRowActions actions={actions} />
          {author}
        </div>
      )}
    </li>
  );
}
