import { ExtraDoseWarning } from "~/components/medications";
import { useDueDoses } from "~/lib/medications/dueDoses.sync";
import { extraDoseText, overMaxText } from "~/lib/medications/medicationDisplay";

/**
 * Today's double doses of this medication, in the page's header: each slot
 * given more than once ("Given twice: 8:00 and 8:20"), or an as-needed day
 * past its maximum, read from what's due (`useDueDoses`, the same matching
 * Today uses). Everyone sees it; nothing when there's none.
 */
export function MedicationExtraDoses({ groupId, medicationId }: { groupId: string; medicationId: string }) {
  const { due, ready } = useDueDoses(groupId);
  if (!ready) return null;
  const texts = [
    ...due.slots.filter((s) => s.medication.id === medicationId).map((s) => extraDoseText(s, due.timeZone)),
    ...due.asNeeded.filter((a) => a.medication.id === medicationId).map((a) => overMaxText(a, due.timeZone)),
  ].filter((t): t is string => !!t);
  if (!texts.length) return null;
  return (
    <div className="mt-3 space-y-1" data-medication-extra-doses="">
      {texts.map((text) => (
        <ExtraDoseWarning key={text} text={text} />
      ))}
    </div>
  );
}
