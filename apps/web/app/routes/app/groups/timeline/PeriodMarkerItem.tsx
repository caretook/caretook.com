import type { TimelineView } from "@caretook/data/schema";
import type { PeriodMarker } from "~/lib/care-periods/periodMarkers";
import type { LocalCarePeriod } from "~/lib/care-periods/carePeriods.sync";

import { Link } from "react-router";
import { ICON_SM } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { markerSentence, markerText, periodTypeMeta } from "~/lib/care-periods/periodDisplay";

const ITEM_CLASS: Record<TimelineView, string> = {
  rows: "bg-base-200/50",
  cards: "rounded-box border-base-300 overflow-hidden border border-dashed",
};

/**
 * A care period's boundary marker, among the day's entries: "Home →
 * Hospital · 14:20" ("Started: Home" for the first) with the new type's
 * icon, one link to the period, read as one sentence. No place or room: the
 * line stays short, and the period's page shows them. Times are the
 * recipient's. Not an entry: no author, no ⋯ menu.
 */
export function PeriodMarkerItem({
  marker,
  groupId,
  timeZone,
  view,
}: {
  marker: PeriodMarker<LocalCarePeriod>;
  groupId: string;
  /** The recipient's zone. */
  timeZone: string;
  view: TimelineView;
}) {
  const words = { from: marker.from, to: marker.to };
  const Icon = periodTypeMeta(marker.to.type).icon;
  return (
    <li className={ITEM_CLASS[view]} data-marker={marker.id} data-at={marker.at}>
      <Link
        to={appUrls.period(groupId, marker.id)}
        aria-label={markerSentence(words, timeZone)}
        className="hover:bg-base-200 focus-visible:outline-primary flex items-center gap-2.5 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <span className="bg-base-300/70 text-muted inline-flex size-6 shrink-0 items-center justify-center rounded-full">
          <Icon className={ICON_SM} strokeWidth={2.25} aria-hidden="true" />
        </span>
        <span className="min-w-0 break-words" aria-hidden="true">
          {markerText(words, timeZone)}
        </span>
      </Link>
    </li>
  );
}
