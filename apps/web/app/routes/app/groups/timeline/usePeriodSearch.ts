import type { SearchPeriodRow } from "~/lib/sync/periodSearch";

import { useGroup } from "~/lib/group";
import { findPeriodChoice } from "~/lib/periodSearch";
import { useSearchPeriods } from "~/lib/sync/periodSearch";

/**
 * The timeline search's care period (`?period=`, only while searching): the
 * group's choices (live), the chosen one if it's on the track, and the range
 * the matches are narrowed to (none for a period that's gone).
 */
export function usePeriodSearch(groupId: string, periodId: string | null, initial: SearchPeriodRow[]) {
  const { recipient } = useGroup();
  const choices = useSearchPeriods(groupId, initial, recipient?.timeZone ?? "UTC");
  const current = findPeriodChoice(choices, periodId);
  return { choices, current, range: current?.range ?? null };
}
