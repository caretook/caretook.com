import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { TodayStatus } from "./todayStatus";

import { BellRing, ChevronRight, OctagonAlert, TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { STALE } from "./layout";

/**
 * Each status's look: a tinted row in the theme's colour, its own icon (so
 * it never rests on colour alone) and its words for screen readers.
 */
export const STATUS_LOOK: Record<
  Exclude<TodayStatus, "neutral">,
  { row: string; icon: string; Icon: LucideIcon; label: string }
> = {
  error: { row: "bg-error/10", icon: "text-error", Icon: OctagonAlert, label: "Urgent" },
  warning: { row: "bg-warning/10", icon: "text-warning", Icon: TriangleAlert, label: "Needs attention" },
  info: { row: "bg-info/10", icon: "text-info", Icon: BellRing, label: "Coming up soon" },
};

/** The card's rows are this tall at least, and so is a row's skeleton (nothing moves when it answers). */
const ROW_HEIGHT = "min-h-9";

/** The row's end, See all or Show all: the same quiet link look. */
const END_LOOK =
  "link-hover text-base-content/70 inline-flex shrink-0 items-center text-xs whitespace-nowrap";

/** A row's place while nothing is known yet (a first visit this session). */
export function TodayRowSkeleton({ row }: { row: string }) {
  return (
    <li aria-hidden="true" data-today-skeleton={row}>
      <div className={`${ROW_HEIGHT} flex items-center px-3`}>
        <span className="skeleton h-4 w-2/3" />
      </div>
    </li>
  );
}

/**
 * One row of the Today card: the row's icon (its status's icon while it has
 * one, else the row's own in `iconClass`), the content on one line, an
 * optional action, and "See all ›" to the row's full view, the same on every
 * row. An `expandable` row (vitals, B-186) has no See all: while its line
 * doesn't fit, a "Show all" button wraps it in place ("Show less" folds it
 * back); when it fits there's no button. `stale` dims it (remembered, not
 * yet confirmed: `data-stale`), and `below` sits under the line (a status or
 * an Undo).
 */
export function TodayRow({
  row,
  status,
  Icon,
  iconClass = "text-base-content/70",
  action,
  below,
  stale = false,
  children,
  ...end
}: {
  /** `data-today-row`: vitals, appointment, medications or tasks. */
  row: string;
  status: TodayStatus;
  Icon: LucideIcon;
  iconClass?: string;
  action?: ReactNode;
  below?: ReactNode;
  stale?: boolean;
  children: ReactNode;
} & (
  | {
      /** The row's full view. */
      seeAll: string;
      /** Its name for screen readers: "See all vitals". */
      seeAllLabel: string;
      expandable?: never;
    }
  | {
      /** Show all in place instead of See all. */
      expandable: true;
      seeAll?: never;
      seeAllLabel?: never;
    }
)) {
  const look = status === "neutral" ? null : STATUS_LOOK[status];
  const Shown = look?.Icon ?? Icon;
  const lineId = useId();
  const line = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const canExpand = end.expandable === true;

  // Whether the one line cuts its content off: measured while it's one line
  // (once open it wraps, so it would always fit), whenever its width changes
  // and whenever its content does (new readings don't resize it).
  useEffect(() => {
    const el = line.current;
    if (!el || !canExpand || expanded) return;
    const measure = () => setOverflows(el.scrollWidth > el.clientWidth);
    const resized = new ResizeObserver(measure);
    const changed = new MutationObserver(measure);
    resized.observe(el);
    changed.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      resized.disconnect();
      changed.disconnect();
    };
  }, [canExpand, expanded]);

  return (
    <li
      data-today-row={row}
      data-status={status}
      data-stale={stale ? "" : undefined}
      className={`${look?.row ?? ""} ${stale ? STALE : ""}`}
    >
      <div className={`${ROW_HEIGHT} flex items-center gap-2 px-3 text-sm`}>
        <Shown
          className={`size-4 shrink-0 ${look?.icon ?? iconClass}`}
          aria-hidden="true"
          data-status-icon={look ? status : undefined}
        />
        <div
          ref={line}
          id={lineId}
          className={`min-w-0 flex-1 py-1 ${expanded ? "break-words" : "truncate"}`}
          data-today-line
        >
          {look && (
            <span className="sr-only" data-status-text>
              {look.label}:{" "}
            </span>
          )}
          {children}
        </div>
        {action}
        {end.expandable ? (
          (overflows || expanded) && (
            <button
              type="button"
              className={END_LOOK}
              aria-expanded={expanded}
              aria-controls={lineId}
              onClick={() => setExpanded(!expanded)}
              data-show-all
            >
              {expanded ? "Show less" : "Show all"}
            </button>
          )
        ) : (
          <Link to={end.seeAll} className={END_LOOK} aria-label={end.seeAllLabel} data-see-all>
            See all
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
      {below}
    </li>
  );
}
