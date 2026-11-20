import type { UnitChoices } from "@caretook/data/schema";
import type { LatestVital } from "~/lib/rpc";

import { formatReading, VITALS } from "@caretook/data/schema";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { KIND_META } from "~/lib/entryDisplay";
import { formatAgo } from "~/lib/format";
import { STRIP_ACTION, STRIP_CLASS, STRIP_ICON } from "./layout";

/** How many readings the collapsed line holds; "All vitals" shows the rest. */
export const COLLAPSED_VITALS = 4;

const VitalsIcon = KIND_META.vital.Icon;

/**
 * The newest reading of each vital type, most recent first, in one strip
 * shaped like the Next strip: the vitals icon (named "Latest vitals" for
 * screen readers), up to `COLLAPSED_VITALS` readings (clipped under a fade
 * when the line is too narrow, with no measuring), and "All vitals", which is
 * never clipped. Expanded, every type's reading wraps below the line. The
 * expanded state isn't remembered. Hidden below `sm` (CSS only): phones keep
 * the header short.
 */
export function LatestVitals({ vitals, units }: { vitals: LatestVital[]; units: UnitChoices }) {
  const [expanded, setExpanded] = useState(false);
  if (!vitals.length) return null;
  const sorted = [...vitals].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const shown = expanded ? sorted : sorted.slice(0, COLLAPSED_VITALS);

  return (
    <section aria-labelledby="latest-vitals" className={`${STRIP_CLASS} flex-wrap gap-y-0 max-sm:hidden`}>
      <h2 id="latest-vitals" className="flex shrink-0 items-center">
        <VitalsIcon className={`${STRIP_ICON} text-secondary`} aria-hidden="true" />
        <span className="sr-only">Latest vitals</span>
      </h2>
      <ul
        id="latest-vitals-list"
        className={
          expanded
            ? "order-last flex basis-full flex-wrap gap-x-4 gap-y-1 pt-0.5 pb-1.5"
            : "flex h-7 min-w-0 flex-1 items-center gap-2 overflow-hidden [mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)]"
        }
      >
        {shown.map(({ reading, occurredAt }) => (
          <li
            key={reading.type}
            className={`shrink-0 whitespace-nowrap ${
              expanded
                ? ""
                : "not-first:before:text-base-content/40 not-first:before:mr-2 not-first:before:content-['·']"
            }`}
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
        className={`${STRIP_ACTION} ml-auto gap-0.5`}
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
