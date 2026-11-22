import type { ReactNode } from "react";
import type { LocalCarePeriod } from "~/lib/care-periods/carePeriods.sync";

import { Badge, DetailHeader, STATUS_TONE } from "~/components/ui";
import { periodTitle, periodTypeMeta } from "~/lib/care-periods/periodDisplay";

/**
 * The period's header (`DetailHeader`): its title with a Now badge while
 * it's where care is, and the type's full name.
 *
 * - `editors`: who is editing the notes now (avatars).
 * - `actions`: Edit (the edit sheet) and ⋯ with Delete, for writers.
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
  return (
    <DetailHeader
      icon={meta.icon}
      tone={current ? "primary" : "muted"}
      title={periodTitle(period)}
      badges={current && <Badge tone={STATUS_TONE.current}>Now</Badge>}
      details={meta.label}
      detailsProps={{ "data-period-type": "" }}
      editors={editors}
      actions={actions}
    />
  );
}
