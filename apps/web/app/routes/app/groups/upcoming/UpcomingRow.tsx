import type { UnitChoices } from "@caretook/data/schema";
import type { TimelineEntry } from "~/lib/rpc";
import type { LinkedContact } from "./upcomingContact";

import { MapPin } from "lucide-react";
import { Link } from "react-router";
import { AuthorFilterLink, EntryBody, KindFilterLink } from "~/components/entry";
import { ContactActions } from "~/components/providers";
import { appUrls } from "~/lib/appUrls";
import { initials } from "~/lib/entryDisplay";
import { entryTiming } from "~/lib/upcoming";
import { cancelledLabel, nowLabel, rescheduledLabel, timeRange, upcomingTitle } from "~/lib/upcomingLabels";
import { placeLine, placeOf, upcomingActions } from "./upcomingContact";

/** Breaks a range after its dash ("10:30 AM–" / "11:15 AM") when the column is narrow. */
const breakable = (text: string) => text.replace("–", "–​");

/**
 * One upcoming (or past) item as a row: kind icon (a filter), its time
 * ("10:30 AM–11:15 AM", "All day", or "Now · until 11:15 AM"), the entry's
 * body with its "with …" line, its place, "Cancelled" (struck through), the
 * call and map actions, and the author's initials (a filter). The whole row
 * opens the entry's page.
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
}: {
  entry: TimelineEntry;
  groupId: string;
  now: Date;
  units: UnitChoices;
  authorName: string;
  authorImage: string | null;
  contacts?: LinkedContact[];
  /** A cancelled event's new one, when it was rescheduled and that's on the device. */
  rescheduledTo?: TimelineEntry;
}) {
  const inProgress = entryTiming(entry, now) === "now";
  const when = inProgress ? nowLabel(entry) : timeRange(entry);
  const cancelled = cancelledLabel(entry);
  const place = placeOf(entry, contacts);
  const actions = upcomingActions(entry, contacts);

  return (
    <li
      className="relative isolate flex items-start gap-2.5 px-3 py-2"
      data-upcoming-item={entry.id}
      data-cancelled={cancelled ? "" : undefined}
    >
      <Link
        to={appUrls.entry(groupId, entry.id)}
        className="hover:bg-base-content/5 focus-visible:outline-primary absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:-outline-offset-2 focus-visible:outline-2"
        aria-label={`Open ${upcomingTitle(entry)}, ${when}${cancelled ? `, ${cancelled.toLowerCase()}` : ""}`}
      />
      <KindFilterLink kind={entry.kind} size="sm" />
      <time
        dateTime={entry.occurredAt}
        className={`w-[5.5rem] shrink-0 pt-0.5 text-sm tabular-nums ${inProgress ? "text-primary font-semibold" : "text-base-content/70"}`}
        data-when
      >
        {breakable(when)}
      </time>
      <div className="min-w-0 flex-1 pt-0.5">
        <EntryBody
          entry={entry}
          units={units}
          clamp
          providers={contacts}
          className={cancelled ? "text-base-content/60 line-through" : ""}
        />
        {place && (
          <p className="text-base-content/70 flex items-start gap-1 text-sm break-words" data-place>
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {placeLine(place.text)}
              {place.from && <span className="text-base-content/50"> · from {place.from}</span>}
            </span>
          </p>
        )}
        {cancelled && (
          <p className="text-sm" data-cancelled-label>
            <span className="badge badge-sm badge-ghost">{cancelled}</span>
            {rescheduledTo && (
              <span className="text-base-content/70"> · {rescheduledLabel(rescheduledTo)}</span>
            )}
          </p>
        )}
      </div>
      <ContactActions actions={actions} />
      <AuthorFilterLink
        userId={entry.createdBy}
        name={authorName}
        initials={initials(authorName)}
        image={authorImage}
      />
    </li>
  );
}
