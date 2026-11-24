import { useId, useMemo, useState } from "react";
import { ComboBox } from "~/components/ui";
import { conditionSuggestions } from "~/lib/profiles/conditionSuggestions";
import { CONDITION_FIELD } from "./conditionActions";

/**
 * The condition's name: a combo box whose text is the name, with plain-
 * language suggestions as you type (the group's own names first). Picking
 * one fills it in; any other text is kept as typed. Posts `name`.
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
  const labelId = useId();
  const errorId = useId();
  const [name, setName] = useState(initial);
  const options = useMemo(
    () => conditionSuggestions(name, groupNames).map((label) => ({ id: label, label })),
    [name, groupNames],
  );

  return (
    <div className="fieldset" data-condition-name-field="">
      <span id={labelId} className="fieldset-legend">
        Condition
      </span>
      <div role="group" aria-labelledby={labelId} aria-describedby={error ? errorId : undefined}>
        <ComboBox
          label="Condition"
          placeholder="e.g. High blood pressure"
          options={options}
          inputValue={name}
          onInputChange={setName}
          onSelect={setName}
          emptyText="No suggestions: keep typing to use your own words"
        />
      </div>
      <input type="hidden" name={CONDITION_FIELD.name} value={name} />
      {error && (
        <p id={errorId} className="text-error-ink text-sm" role="alert" data-name-error="">
          {error}
        </p>
      )}
    </div>
  );
}
