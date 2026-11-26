import type { MedicationType } from "@caretook/data/schema";
import type { FieldIssue } from "~/lib/core/api";
import type { MedicationNameRow } from "~/lib/medications/medications.sync";

import { useState } from "react";
import { MEDICATION_LIMITS, MEDICATION_TYPES } from "@caretook/data/schema";
import { NameField } from "~/components/medications";
import { ChoiceGroup, Field } from "~/components/ui";
import { MEDICATION_TYPE_LABELS } from "~/lib/medications/medicationDisplay";
import { QUICK_ADD_FIELD } from "./doseFormData";
import { issueFor } from "./formIssues";

const TYPE_OPTIONS = MEDICATION_TYPES.map((type) => ({ value: type, label: MEDICATION_TYPE_LABELS[type] }));

/**
 * The Dose sheet's "+ New medication": the name (suggested as you type,
 * and a warning on an allergy match), the dose each time and the type
 * (Prescription to start with, required), under the Medication choice. The
 * rest (strength, directions, a schedule) is the medication's edit sheet's,
 * through the notice after logging.
 */
export function QuickAddFields({
  names,
  issues,
  onDoseChange,
}: {
  names: readonly MedicationNameRow[];
  issues: FieldIssue[];
  /** The typed dose, which the dose's amount follows until it's typed in. */
  onDoseChange: (dose: string) => void;
}) {
  const [type, setType] = useState<MedicationType>("prescription");
  return (
    <div className="space-y-1" data-quick-add>
      <NameField defaultValue="" names={names} error={issueFor(issues, "name")} />
      <Field label="Dose each time" kind="input" error={issueFor(issues, "dose")}>
        {(control) => (
          <input
            {...control}
            name={QUICK_ADD_FIELD.dose}
            maxLength={MEDICATION_LIMITS.dose}
            placeholder="e.g. 2 tablets"
            onChange={(e) => onDoseChange(e.target.value)}
          />
        )}
      </Field>
      <ChoiceGroup
        name={QUICK_ADD_FIELD.type}
        label="Type"
        required
        options={TYPE_OPTIONS}
        value={type}
        onChange={setType}
        error={issueFor(issues, "type")}
      />
    </div>
  );
}
