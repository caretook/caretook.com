import type { SymptomDetails } from "@caretook/data/schema";

import { useId } from "react";
import { TIMELINE_LIMITS } from "@caretook/data/schema";
import { Field } from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { useSymptomTypes } from "~/lib/timeline/symptomTypes.sync";

/**
 * A symptom's own fields: what it is (required) and how bad, 0 to 10. The
 * name suggests the group's catalog as you type (a native `datalist`, from
 * the local copy); any other name can still be typed.
 */
export function SymptomFields({ stored, nameError }: { stored?: SymptomDetails; nameError?: string }) {
  const { id: groupId } = useGroup();
  const catalog = useSymptomTypes(groupId);
  const listId = useId();
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
            list={listId}
            autoComplete="off"
          />
        )}
      </Field>
      <datalist id={listId}>
        {catalog.map((type) => (
          <option key={type.id} value={type.name} />
        ))}
      </datalist>
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
