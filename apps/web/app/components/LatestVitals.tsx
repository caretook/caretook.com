import type { UnitChoices } from "@caretook/data/schema";
import type { LatestVital } from "~/lib/rpc";

import { formatReading, VITALS } from "@caretook/data/schema";
import { useState } from "react";
import { formatAgo } from "~/lib/format";

/** How many readings a phone shows before "Show all". Wider screens show every one. */
const PHONE_LIMIT = 4;

/** The newest reading of each vital type, most recent first, with how long ago it was taken. */
export function LatestVitals({ vitals, units }: { vitals: LatestVital[]; units: UnitChoices }) {
  const [showAll, setShowAll] = useState(false);
  if (!vitals.length) return null;
  const sorted = [...vitals].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const hidden = sorted.length - PHONE_LIMIT;

  return (
    <section aria-labelledby="latest-vitals">
      <h2
        id="latest-vitals"
        className="text-base-content/70 mb-1.5 text-xs font-semibold tracking-wide uppercase"
      >
        Latest vitals
      </h2>
      <ul id="latest-vitals-list" className="flex flex-wrap gap-1.5">
        {sorted.map(({ reading, occurredAt }, i) => (
          <li
            key={reading.type}
            className={`rounded-field border-base-300 bg-base-100 border px-2 py-1 text-sm ${
              i >= PHONE_LIMIT && !showAll ? "hidden sm:block" : ""
            }`}
            title={VITALS[reading.type].label}
          >
            <span className="font-semibold tabular-nums">{formatReading(reading, units)}</span>{" "}
            <time dateTime={occurredAt} className="text-base-content/60 text-xs">
              {formatAgo(occurredAt)}
            </time>
          </li>
        ))}
        {hidden > 0 && (
          <li className="sm:hidden">
            <button
              type="button"
              className="btn btn-ghost btn-sm text-base-content/70 h-full min-h-0 px-2"
              aria-expanded={showAll}
              aria-controls="latest-vitals-list"
              onClick={() => setShowAll((s) => !s)}
            >
              {showAll ? "Show fewer" : `+${hidden} more`}
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}
