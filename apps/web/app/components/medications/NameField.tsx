import type { AllergyRows } from "~/lib/medications/allergies.sync";
import type { MedicationNameRow } from "~/lib/medications/medications.sync";

import { useMemo, useState } from "react";
import { MEDICATION_LIMITS } from "@caretook/data/schema";
import { ComboBox, Field } from "~/components/ui";
import { allergyMatches, allergyWarning } from "~/lib/medications/allergies";
import { useGroup } from "~/lib/app-shell/group";
import { useAllergies } from "~/lib/medications/allergies.sync";
import { medicationNameSuggestions } from "~/lib/medications/medicationNames";

// The allergies before the live query's first answer (a module constant: see `useLiveQuery`).
const NO_ALLERGIES: AllergyRows = { allergyRows: [], statusRows: [] };

/**
 * The medication's name: a combo box whose text is the name, with
 * suggestions once you type (the group's names first, then a curated list of
 * common medications; nothing on focus or for an empty field). Look-alike
 * names (hydroxyzine, hydralazine) are a real risk, so each is listed in
 * full and only a pick fills the field: typing never completes a name, and
 * a pick fills the name alone, never a strength or dose. A name that matches
 * one of the recipient's allergies gets a warning ("Matches an allergy on
 * file: Penicillin (severe)"), which never blocks the save. It posts `name`:
 * the medication form's, and the Dose sheet's quick add.
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
  const options = useMemo(
    () => medicationNameSuggestions(name, names).map((label) => ({ id: label, label })),
    [name, names],
  );
  const { id: groupId } = useGroup();
  const { allergies } = useAllergies(groupId, NO_ALLERGIES);
  const warning = useMemo(
    () => allergyWarning(allergyMatches(name, allergies)) ?? undefined,
    [name, allergies],
  );

  return (
    <Field label="Name" error={error} warning={warning} kind="input" required>
      {(control) => (
        <div data-medication-name-field="">
          <ComboBox
            label="Name"
            placeholder="e.g. Lisinopril"
            options={options}
            inputValue={name}
            onInputChange={setName}
            onSelect={setName}
            emptyText="No suggestions: keep typing to use your own words"
            opensOn="typing"
            control={{ ...control, name: "name", maxLength: MEDICATION_LIMITS.name }}
          />
        </div>
      )}
    </Field>
  );
}
