import { useMemo } from "react";
import { duePasses } from "~/lib/medications/duePasses";
import { medicationStrip } from "~/lib/medications/medicationStrip";
import { useDueDoses } from "~/lib/medications/dueDoses.sync";

/**
 * The medication strip's data: the pass it shows (`medicationStrip` over
 * today's passes), live and re-evaluated on a timer, and the recipient's
 * zone. Null until the device's rows are read (so nothing flashes as due),
 * and for a group without scheduled medications.
 */
export function useMedicationStrip(groupId: string) {
  const { due, ready, timeZone, passes } = useDueDoses(groupId);
  const strip = useMemo(() => (ready ? medicationStrip(duePasses(due, passes)) : null), [due, ready, passes]);
  return { strip, timeZone };
}
