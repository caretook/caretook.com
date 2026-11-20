import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { TodayStatus } from "./todayStatus";

import { BellRing, ChevronRight, OctagonAlert, TriangleAlert } from "lucide-react";
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
 * row. `stale` dims it (remembered, not yet confirmed: `data-stale`), and
 * `below` sits under the line (a status or an Undo).
 */
export function TodayRow({
  row,
  status,
  Icon,
  iconClass = "text-base-content/70",
  seeAll,
  seeAllLabel,
  action,
  below,
  stale = false,
  children,
}: {
  /** `data-today-row`: vitals, appointment, medications or tasks. */
  row: string;
  status: TodayStatus;
  Icon: LucideIcon;
  iconClass?: string;
  /** The row's full view. */
  seeAll: string;
  /** Its name for screen readers: "See all vitals". */
  seeAllLabel: string;
  action?: ReactNode;
  below?: ReactNode;
  stale?: boolean;
  children: ReactNode;
}) {
  const look = status === "neutral" ? null : STATUS_LOOK[status];
  const Shown = look?.Icon ?? Icon;
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
        <div className="min-w-0 flex-1 truncate py-1">
          {look && (
            <span className="sr-only" data-status-text>
              {look.label}:{" "}
            </span>
          )}
          {children}
        </div>
        {action}
        <Link
          to={seeAll}
          className="link-hover text-base-content/70 inline-flex shrink-0 items-center text-xs whitespace-nowrap"
          aria-label={seeAllLabel}
          data-see-all
        >
          See all
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      {below}
    </li>
  );
}
