import type { UnitChoices, VitalFieldSpec } from "@caretook/data/schema";

import { useState } from "react";
import { fieldStep, fieldUnitLabel } from "@caretook/data/schema";
import { Field } from "~/components/ui";
import { bristolOptions, inputValue, isChoiceField, isUnusualInput } from "./vitalInputs";

const UNUSUAL = "That's unusual. Double-check it before saving.";

/**
 * One number of a vital reading, from its spec: typed in the user's units
 * with the unit beside it, warning (but still saving) outside the typical
 * range. The Bristol type is a choice from its scale instead.
 */
export function VitalField({
  field,
  name,
  stored,
  units,
  error,
}: {
  field: VitalFieldSpec;
  name: string;
  /** The stored (canonical) value when editing. */
  stored: unknown;
  units: UnitChoices;
  error?: string;
}) {
  const [unusual, setUnusual] = useState(false);
  const shown = inputValue(field, stored, units);

  if (isChoiceField(field))
    return (
      <Field label={field.label} error={error}>
        {(control) => (
          <select {...control} name={name} className="select w-full" defaultValue={shown}>
            <option value="">{field.optional ? "Not noted" : "Choose…"}</option>
            {bristolOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </Field>
    );

  const unit = fieldUnitLabel(field, units);
  return (
    <Field
      label={`${field.label}${field.optional ? " (optional)" : ""}`}
      error={error}
      warning={unusual ? UNUSUAL : undefined}
    >
      {(control) => (
        <label className={`input w-full ${error ? "input-error" : unusual ? "input-warning" : ""}`}>
          <input
            {...control}
            name={name}
            type="number"
            inputMode={field.integer ? "numeric" : "decimal"}
            step={fieldStep(field, units)}
            defaultValue={shown}
            onChange={(e) => setUnusual(isUnusualInput(field, e.currentTarget.valueAsNumber, units))}
          />
          {unit && <span className="label">{unit}</span>}
        </label>
      )}
    </Field>
  );
}
