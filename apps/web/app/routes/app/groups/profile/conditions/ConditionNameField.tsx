import { useMemo, useState } from "react";
import { ComboBox, Field } from "~/components/ui";
import { conditionSuggestions } from "~/lib/profiles/conditionSuggestions";
import { CONDITION_FIELD } from "./conditionActions";

/**
 * The condition's name (required): a combo box whose text is the name, with
 * plain-language suggestions once you type (the group's own names first;
 * none on focus or for an empty field). Picking one fills it in; any other
 * text is kept as typed. Posts `name`.
 */
export function ConditionNameField({
  initial,
  groupNames,
  error,
}: {
  initial: string;
  groupNames: readonly string[];
  error?: string;
}) {
  const [name, setName] = useState(initial);
  const options = useMemo(
    () => conditionSuggestions(name, groupNames).map((label) => ({ id: label, label })),
    [name, groupNames],
  );

  return (
    <Field label="Condition" error={error} required>
      {(control) => (
        <div data-condition-name-field="">
          <ComboBox
            label="Condition"
            placeholder="e.g. High blood pressure"
            options={options}
            inputValue={name}
            onInputChange={setName}
            onSelect={setName}
            emptyText="No suggestions: keep typing to use your own words"
            opensOn="typing"
            control={control}
          />
          <input type="hidden" name={CONDITION_FIELD.name} value={name} />
        </div>
      )}
    </Field>
  );
}
