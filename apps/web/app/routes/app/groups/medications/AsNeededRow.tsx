import type { AsNeededToday, DueDoses } from "~/lib/medications/dueDoses";

import { Message } from "~/components/ui";
import { ExtraDoseWarning, MedicationCard } from "~/components/medications";
import { asNeededCountText, overMaxText } from "~/lib/medications/medicationDisplay";
import { AsNeededLogButton, useAsNeededLog } from "./AsNeededLog";

/**
 * An as-needed medication's day, as its `MedicationCard` (the whole card
 * opens its page): "2 of 4 today", and, for writers, Log (a dose given now).
 * Past the maximum it asks first, and still logs on confirm; once past it,
 * it says so with each time.
 */
export function AsNeededRow({
  item,
  due,
  groupId,
  canWrite,
}: {
  item: AsNeededToday;
  due: DueDoses;
  groupId: string;
  canWrite: boolean;
}) {
  const { medication } = item;
  const logging = useAsNeededLog(groupId, due, medication);
  const over = overMaxText(item, due.timeZone);

  return (
    <MedicationCard
      medication={medication}
      groupId={groupId}
      data-as-needed={medication.id}
      actions={canWrite && <AsNeededLogButton medication={medication} logging={logging} />}
      notes={
        (over || logging.error) && (
          <>
            {over && <ExtraDoseWarning text={over} />}
            {logging.error && <Message tone="error">{logging.error}</Message>}
          </>
        )
      }
    >
      <p className="text-muted text-sm" data-as-needed-count>
        {asNeededCountText(item)}
      </p>
    </MedicationCard>
  );
}
