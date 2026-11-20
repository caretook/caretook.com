import type { AllergyRows } from "~/lib/medications/allergies.sync";
import type { MedicationNameRow } from "~/lib/medications/medications.sync";

import { useMemo, useRef, useState } from "react";
import { MEDICATION_LIMITS } from "@caretook/data/schema";
import { ChipGroup, Field } from "~/components/ui";
import { allergyMatches, allergyWarning } from "~/lib/medications/allergies";
import { useGroup } from "~/lib/app-shell/group";
import { useAllergies } from "~/lib/medications/allergies.sync";
import { suggestMedicationNames } from "~/lib/medications/medicationNames";
import { FIELD } from "./medicationFormData";

// The allergies before the live query's first answer (a module constant: see `useLiveQuery`).
const NO_ALLERGIES: AllergyRows = { allergyRows: [], statusRows: [] };

/**
 * The medication's name, with names the group has used before suggested
 * under it as you type ("lis" → Lisinopril): a tap fills the name, nothing
 * else, and puts the cursor back in the field. A name that matches one of
 * the recipient's allergies gets a warning ("Matches an allergy on file:
 * Penicillin (severe)"), which never blocks the save.
 */
export function NameField({
  defaultValue,
  names,
  error,
}: {
  defaultValue: string;
  names: readonly MedicationNameRow[];
  error?: string;
}) {
  const [name, setName] = useState(defaultValue);
  const input = useRef<HTMLInputElement>(null);
  const suggestions = useMemo(() => suggestMedicationNames(name, names), [name, names]);
  const { id: groupId } = useGroup();
  const { allergies } = useAllergies(groupId, NO_ALLERGIES);
  const warning = useMemo(
    () => allergyWarning(allergyMatches(name, allergies)) ?? undefined,
    [name, allergies],
  );

  return (
    <div>
      <Field label="Name" error={error} warning={warning}>
        {(control) => (
          <input
            {...control}
            ref={input}
            name={FIELD.name}
            className="input w-full"
            maxLength={MEDICATION_LIMITS.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lisinopril"
            autoComplete="off"
          />
        )}
      </Field>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1" data-name-suggestions>
          <span className="text-base-content/70 text-sm">Used before</span>
          <ChipGroup
            label="Names used before"
            actions={suggestions.map((suggestion) => ({
              id: suggestion,
              label: suggestion,
              onPress: () => {
                setName(suggestion);
                input.current?.focus();
              },
            }))}
          />
        </div>
      )}
    </div>
  );
}
