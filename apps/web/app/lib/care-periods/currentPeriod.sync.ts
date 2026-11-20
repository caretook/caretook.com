import type { PeriodSpan } from "@caretook/data/schema";
import type { CarePeriodRow, LocalCarePeriod } from "./carePeriods.sync";

import { currentPeriod } from "@caretook/data/schema";
import { useMemo } from "react";
import { useLiveQuery } from "../sync/index";
import { carePeriodsQuery, toPeriodSpans } from "./carePeriods.sync";
import { useNow } from "../live-notes/editors.sync";

// One array for every render: `useLiveQuery` treats a new `initial` as new loader data.
const NO_ROWS: CarePeriodRow[] = [];

export type CurrentCarePeriod = { span: PeriodSpan<LocalCarePeriod>; day: number };

/**
 * The group's current care period and its "day N" in the recipient's zone,
 * or null with no periods. Live from the device's copy (so a new period
 * shows without a reload, and offline), re-evaluated once a minute so the
 * day turns over at midnight. Rows are kept to `groupId`, so after switching
 * groups the previous group's period never shows while the new query starts.
 */
export const useCurrentCarePeriod = (groupId: string, timeZone: string | null): CurrentCarePeriod | null => {
  const query = useMemo(() => carePeriodsQuery(groupId), [groupId]);
  const rows = useLiveQuery<CarePeriodRow>(query.sql, query.params, NO_ROWS);
  const now = useNow(60_000);
  return useMemo(() => {
    const own = rows.filter((row) => row.group_id === groupId);
    return currentPeriod(toPeriodSpans(own), now, timeZone ?? "UTC");
  }, [rows, groupId, now, timeZone]);
};
