import type { SymptomDetails } from "@caretook/data/schema";

import { TIMELINE_LIMITS } from "@caretook/data/schema";
import { Field } from "~/components/ui";

/** A symptom's own fields: what it is (required) and how bad, 0 to 10. */
export function SymptomFields({ stored, nameError }: { stored?: SymptomDetails; nameError?: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
      <Field label="Symptom" kind="input" error={nameError}>
        {(control) => (
          <input
            {...control}
            name="symptomName"
            maxLength={TIMELINE_LIMITS.symptomName}
            defaultValue={stored?.name ?? ""}
            placeholder="e.g. Knee pain"
          />
        )}
      </Field>
      <Field label="Severity">
        {(control) => (
          <select {...control} name="severity" className="select" defaultValue={stored?.severity ?? ""}>
            <option value="">Not rated</option>
            {Array.from({ length: TIMELINE_LIMITS.severityMax + 1 }, (_, n) => (
              <option key={n} value={n}>
                {n} / {TIMELINE_LIMITS.severityMax}
              </option>
            ))}
          </select>
        )}
      </Field>
    </div>
  );
}
