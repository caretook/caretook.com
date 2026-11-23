import type { LocalCondition } from "~/lib/profiles/conditions.sync";

import { useId, useMemo, useState } from "react";
import { ChipList, ComboBox, Message } from "~/components/ui";
import { conditionChoices, hasConditionChoices } from "~/lib/profiles/medicationConditionChoices";
import { FIELD } from "./medicationFormData";

/**
 * The medication form's "For" field (conditions slice 4): any number of the
 * recipient's conditions, each a chip with × once chosen, picked from a
 * combo box over the live active ones (a resolved one only when the
 * medication is already for it). Posts one `conditionId` per chosen
 * condition. Beside the free-text reason, which stays. Left out when the
 * profile has nothing to offer.
 */
export function ConditionsField({
  conditions,
  initialIds,
  error,
}: {
  /** The recipient's live conditions. */
  conditions: readonly LocalCondition[];
  /** What the medication is for as the form opens. */
  initialIds: readonly string[];
  error?: string;
}) {
  const legendId = useId();
  const [chosen, setChosen] = useState<string[]>(() => [...initialIds]);
  const [text, setText] = useState("");
  const options = useMemo(
    () => conditionChoices({ conditions, linkedIds: initialIds, chosenIds: chosen, text }),
    [conditions, initialIds, chosen, text],
  );
  const byId = useMemo(() => new Map(conditions.map((c) => [c.id, c])), [conditions]);
  // A chosen condition deleted while the form is open drops out.
  const shown = chosen.filter((id) => byId.has(id));

  if (!hasConditionChoices(conditions, initialIds) && !shown.length) return null;

  return (
    <div className="fieldset" data-conditions-picker>
      <span id={legendId} className="fieldset-legend">
        For (optional)
      </span>
      {shown.length > 0 && (
        <ChipList
          label="Conditions it's for"
          className="mb-1.5"
          chips={shown.map((id) => {
            const condition = byId.get(id)!;
            return {
              id,
              label: condition.name,
              // Plain text: a link would leave the form unsaved.
              to: null,
              muted: condition.status === "resolved",
              removeLabel: `Remove ${condition.name}`,
              onRemove: () => setChosen((ids) => ids.filter((c) => c !== id)),
            };
          })}
        />
      )}
      <div role="group" aria-labelledby={legendId}>
        <ComboBox
          label="Add a condition it's for"
          placeholder="Choose a condition"
          options={options}
          inputValue={text}
          onInputChange={setText}
          onSelect={(id) => {
            setChosen((ids) => (ids.includes(id) ? ids : [...ids, id]));
            setText("");
          }}
          emptyText="No other conditions on the profile"
        />
      </div>
      {shown.map((id) => (
        <input key={id} type="hidden" name={FIELD.conditionId} value={id} />
      ))}
      {error && (
        <Message tone="error" data-picker-error="">
          {error}
        </Message>
      )}
    </div>
  );
}
