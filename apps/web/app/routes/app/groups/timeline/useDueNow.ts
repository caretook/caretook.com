import { useMemo } from "react";
import { dueNow } from "~/lib/dueDoses";
import { useDueDoses } from "~/lib/sync/dueDoses";

/**
 * The Due now strip's data: today's slots that are due or overdue (by time),
 * live and re-evaluated on a timer (none until the device's rows are read),
 * and the recipient's zone they're in.
 */
export function useDueNow(groupId: string) {
  const { due, ready, timeZone } = useDueDoses(groupId);
  // Nothing until the doses are read: otherwise every slot would flash as due.
  const slots = useMemo(() => (ready ? dueNow(due) : []), [due, ready]);
  return { slots, timeZone };
}
