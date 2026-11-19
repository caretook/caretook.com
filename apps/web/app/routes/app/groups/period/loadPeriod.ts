import type { SyncDb } from "~/lib/sync";
import type { CarePeriodRow } from "~/lib/sync/carePeriods";
import type { ProviderRow } from "~/lib/sync/providers";

import { data } from "react-router";
import { carePeriodQuery, carePeriodsQuery, toCarePeriod } from "~/lib/sync/carePeriods";
import { providerQuery } from "~/lib/sync/providers";
import { readRows } from "~/lib/sync/timeline";

/**
 * The period, the group's track (for its end) and its place. A period that
 * isn't on the device, is deleted, or is in another group is a 404 with no
 * names. (The group route has already turned away a non-member.)
 */
export async function loadPeriod(db: SyncDb, groupId: string, periodId: string) {
  const [row] = await readRows<CarePeriodRow>(db, carePeriodQuery(periodId));
  const period = row ? toCarePeriod(row) : null;
  if (!period || period.groupId !== groupId || period.deletedAt) throw data("Not found", { status: 404 });
  const [trackRows, placeRows] = await Promise.all([
    readRows<CarePeriodRow>(db, carePeriodsQuery(groupId)),
    period.placeProviderId
      ? readRows<ProviderRow>(db, providerQuery(period.placeProviderId))
      : Promise.resolve([]),
  ]);
  return { period, trackRows, placeRows };
}
