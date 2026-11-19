import type { ReactNode } from "react";
import type { UpcomingListData } from "./useUpcomingData";

import { resolveUnits } from "@caretook/data/schema";
import { UpcomingRow } from "./UpcomingRow";

// Upcoming lists notes and events only, which show no vital readings: the default units do.
const UNITS = resolveUnits(null);

const LIST_CLASS = "rounded-box border-base-300 bg-base-100 divide-base-200 divide-y overflow-hidden border";

/**
 * Upcoming's (or the Past tab's) items, a section per day under a sticky
 * heading ("Now", "Today", "Tomorrow", "Friday, Nov 27"), with `empty`
 * when there are none. `children` comes after the last section (the Past
 * tab's paging).
 */
export function UpcomingList({
  data,
  groupId,
  label,
  empty,
  children,
}: {
  data: UpcomingListData;
  groupId: string;
  /** The list's name for screen readers ("Upcoming", "Past events"). */
  label: string;
  empty: string;
  children?: ReactNode;
}) {
  return (
    <section aria-labelledby="upcoming-list-heading" className="space-y-4" data-upcoming-list>
      <h2 id="upcoming-list-heading" className="sr-only">
        {label}
      </h2>
      {data.sections.length === 0 && (
        <p className="text-base-content/70" data-empty>
          {empty}
        </p>
      )}
      {data.sections.map((section) => (
        <section key={section.key} aria-labelledby={`day-${section.key}`} data-day={section.key}>
          <h3
            id={`day-${section.key}`}
            className="bg-base-200/95 text-base-content sticky top-0 z-10 -mx-1 px-1 py-2 text-base font-semibold backdrop-blur lg:text-lg"
          >
            {section.label}
          </h3>
          <ol className={LIST_CLASS}>
            {section.items.map((entry) => (
              <UpcomingRow
                key={entry.id}
                entry={entry}
                groupId={groupId}
                now={data.now}
                units={UNITS}
                authorName={data.nameOf(entry.createdBy)}
                authorImage={data.imageOf(entry.createdBy)}
                contacts={data.contactsOf(entry.id)}
                rescheduledTo={entry.rescheduledTo ? data.byId.get(entry.rescheduledTo) : undefined}
              />
            ))}
          </ol>
        </section>
      ))}
      {children}
    </section>
  );
}
