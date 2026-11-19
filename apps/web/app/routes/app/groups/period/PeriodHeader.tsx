import type { ReactNode } from "react";
import type { LocalCarePeriod } from "~/lib/sync/carePeriods";

import { periodTitle, periodTypeMeta } from "~/lib/periodDisplay";

/**
 * The period's header, in regions like `MedicationHeader`'s:
 *
 *   [icon] [type · label, Now badge] [editors] [actions]
 *          [the type's full name]
 *
 * - `editors`: who is editing the notes now (avatars).
 * - `actions`: Edit (the edit sheet) and ⋯ with Delete, for writers.
 *
 * Empty regions take no space.
 */
export function PeriodHeader({
  period,
  current,
  editors,
  actions,
}: {
  period: LocalCarePeriod;
  /** The latest period on the track: where care is now. */
  current: boolean;
  editors?: ReactNode;
  actions?: ReactNode;
}) {
  const meta = periodTypeMeta(period.type);
  const Icon = meta.icon;
  return (
    <header className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={`grid size-9 shrink-0 place-items-center rounded-full ${current ? "bg-primary/15 text-primary" : "bg-base-200 text-base-content/70"}`}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div data-region="title" className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="text-xl font-semibold wrap-break-word">{periodTitle(period)}</h1>
          {current && <span className="badge badge-primary badge-sm">Now</span>}
        </div>
        <p data-region="details" className="text-base-content/70 text-sm" data-period-type>
          {meta.label}
        </p>
      </div>
      {editors && (
        <div data-region="editors" className="flex shrink-0 items-center -space-x-1.5 pt-1">
          {editors}
        </div>
      )}
      {actions && (
        <div data-region="actions" className="flex shrink-0 items-center gap-1">
          {actions}
        </div>
      )}
    </header>
  );
}
