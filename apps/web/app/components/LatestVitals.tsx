import type { UnitChoices } from "@caretook/data/schema";
import type { LatestVital } from "~/lib/rpc";

import { formatReading, VITALS } from "@caretook/data/schema";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { formatAgo } from "~/lib/format";

/**
 * The newest reading of each vital type, most recent first, in one line: a
 * "Latest" label (on screens wider than a phone), as many readings as fit (the
 * rest are clipped under a fade, with no measuring), and "All vitals", which is
 * never clipped. Expanded, the same list wraps below the line and shows every
 * type. The expanded state isn't remembered.
 */
export function LatestVitals({ vitals, units }: { vitals: LatestVital[]; units: UnitChoices }) {
  const [expanded, setExpanded] = useState(false);
  if (!vitals.length) return null;
  const sorted = [...vitals].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return (
    <section aria-labelledby="latest-vitals" className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      {/* Phones leave the label out (it stays for screen readers), so a second reading fits. */}
      <h2
        id="latest-vitals"
        className="text-base-content/70 sr-only text-xs font-semibold tracking-wide uppercase sm:not-sr-only sm:shrink-0"
      >
        Latest<span className="sr-only"> vitals</span>
      </h2>
      <ul
        id="latest-vitals-list"
        className={
          expanded
            ? "order-last flex basis-full flex-wrap gap-1.5"
            : "flex h-8 min-w-0 flex-1 items-center gap-1.5 overflow-hidden [mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)]"
        }
      >
        {sorted.map(({ reading, occurredAt }) => (
          <li
            key={reading.type}
            className="rounded-field border-base-300 bg-base-100 shrink-0 border px-2 py-1 text-sm whitespace-nowrap"
            title={VITALS[reading.type].label}
          >
            <span className="font-semibold tabular-nums">{formatReading(reading, units)}</span>{" "}
            <time dateTime={occurredAt} className="text-base-content/60 text-xs">
              {formatAgo(occurredAt)}
            </time>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn-ghost btn-sm text-base-content/70 ml-auto shrink-0 gap-0.5 px-2"
        aria-expanded={expanded}
        aria-controls="latest-vitals-list"
        onClick={() => setExpanded((e) => !e)}
      >
        All vitals
        <ChevronRight aria-hidden="true" className={`size-4 ${expanded ? "rotate-90" : ""}`} />
      </button>
    </section>
  );
}
