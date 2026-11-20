import { useMemo } from "react";
import { duePasses } from "~/lib/medications/duePasses";
import { medicationStrip } from "~/lib/medications/medicationStrip";
import { useDueDoses } from "~/lib/medications/dueDoses.sync";

/**
 * The medication strip's data: the pass it shows (`medicationStrip` over
 * today's passes), live and re-evaluated on a timer, and the recipient's
 * zone. `ready` is false until the device's rows are known (remembered from
 * earlier this session or read; the strip shows a skeleton), and `fresh`
 * once they're read live (until then the strip is dimmed). `strip` is null
 * before `ready` and for a group without scheduled medications.
 */
export function useMedicationStrip(groupId: string) {
  const { due, ready, fresh, timeZone, passes } = useDueDoses(groupId);
  const strip = useMemo(() => (ready ? medicationStrip(duePasses(due, passes)) : null), [due, ready, passes]);
  return { strip, ready, fresh, timeZone };
}
