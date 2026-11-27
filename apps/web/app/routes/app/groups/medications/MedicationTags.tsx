import type { LocalMedication } from "~/lib/medications/medications.sync";

import { QuickTags } from "~/components/tags";
import { medicationTitle } from "~/lib/medications/medicationDisplay";

/**
 * The edit sheet's tags (`QuickTags`, tags-2): the medication's chips, live,
 * with an × each and Add tag for whoever may tag it (`canTagRecord`). Each
 * tap is its own local write, never part of the form's Save.
 */
export function MedicationTags({ medication }: { medication: LocalMedication }) {
  return (
    <div className="border-base-300 mt-4 border-t pt-4" data-medication-tags="">
      <QuickTags
        target="medication"
        recordId={medication.id}
        label={medicationTitle(medication)}
        createdBy={medication.createdBy}
        max={null}
      />
    </div>
  );
}
