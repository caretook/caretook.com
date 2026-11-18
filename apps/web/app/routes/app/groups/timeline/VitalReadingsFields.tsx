import type { UnitChoices, VitalFieldSpec, VitalReading, VitalType } from "@caretook/data/schema";
import type { FieldIssue } from "~/lib/api";

import { useId, useState } from "react";
import {
  BP_ORDER_MESSAGE,
  BRISTOL_TYPES,
  fieldRange,
  fieldStep,
  fieldUnitLabel,
  fromDisplay,
  isUnusual,
  toDisplay,
  VITALS,
} from "@caretook/data/schema";
import { vitalInputName } from "./entryFormData";
import { VitalTypeMenu } from "./VitalTypeMenu";

/** A server issue on one field, in words that name the range in the user's units. */
const messageFor = (issue: FieldIssue, field: VitalFieldSpec, units: UnitChoices) => {
  if (issue.message === BP_ORDER_MESSAGE) return issue.message;
  const { min, max } = fieldRange(field, units);
  const unit = fieldUnitLabel(field, units);
  const range = `${min.toLocaleString()} to ${max.toLocaleString()}${unit && unit !== "/10" ? ` ${unit}` : ""}`;
  const what = field.integer ? "a whole number" : "a number";
  return field.optional ? `Leave it blank or enter ${what} from ${range}.` : `Enter ${what} from ${range}.`;
};

/**
 * The readings of one vitals entry: a block per type, each removable while
 * more than one is left, then "Add a reading". Values show and are typed in
 * the user's units; entryContentFromForm converts them back.
 */
export function VitalReadingsFields({
  types,
  onChange,
  initial = [],
  units,
  issues,
}: {
  types: VitalType[];
  onChange: (types: VitalType[]) => void;
  /** Stored readings when editing (canonical units). */
  initial?: VitalReading[];
  units: UnitChoices;
  issues: FieldIssue[];
}) {
  const listIssue = issues.find((i) => i.path === "details.readings" || i.path === "details");
  return (
    <div className="space-y-2">
      {types.map((type, index) => (
        <fieldset key={type} className="fieldset border-base-300 rounded-box border px-3 pb-3">
          <legend className="fieldset-legend flex w-full items-center justify-between gap-2">
            <span>{VITALS[type].label}</span>
            {types.length > 1 && (
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => onChange(types.filter((t) => t !== type))}
              >
                Remove<span className="sr-only"> {VITALS[type].label.toLowerCase()}</span>
              </button>
            )}
          </legend>
          <input type="hidden" name={vitalInputName(index, "type")} value={type} />
          <div className={VITALS[type].fields.length > 1 ? "grid grid-cols-2 gap-2" : ""}>
            {VITALS[type].fields.map((field) => {
              const stored = initial.find((r) => r.type === type) as Record<string, unknown> | undefined;
              const value = stored?.[field.key];
              const issue = issues.find(
                (i) =>
                  i.path === `details.readings.${index}.${field.key}` ||
                  i.path === `details.readings.${index}`,
              );
              return (
                <VitalField
                  key={field.key}
                  type={type}
                  field={field}
                  name={vitalInputName(index, field.key)}
                  defaultValue={typeof value === "number" ? value : null}
                  units={units}
                  error={issue ? messageFor(issue, field, units) : undefined}
                />
              );
            })}
          </div>
        </fieldset>
      ))}

      {listIssue && <p className="text-error text-sm">Add at least one reading, each type once.</p>}

      <VitalTypeMenu
        className="btn btn-sm btn-ghost"
        exclude={types}
        onSelect={(t) => onChange([...types, t])}
      >
        + Add a reading
      </VitalTypeMenu>
    </div>
  );
}

function VitalField({
  type,
  field,
  name,
  defaultValue,
  units,
  error,
}: {
  type: VitalType;
  field: VitalFieldSpec;
  name: string;
  /** Canonical value when editing. */
  defaultValue: number | null;
  units: UnitChoices;
  error?: string;
}) {
  const id = useId();
  const [unusual, setUnusual] = useState(false);
  const shown = defaultValue == null ? "" : String(toDisplay(field, defaultValue, units));
  const describedBy = error ? `${id}-error` : unusual ? `${id}-warn` : undefined;

  // The Bristol type is a choice from a scale, not a measurement.
  if (type === "bowelMovement") {
    const options = Object.entries(BRISTOL_TYPES).map(([n, text]) => ({
      value: n,
      label: `Type ${n}: ${text}`,
    }));
    return (
      <div>
        <label className="label mb-1 text-xs" htmlFor={id}>
          {field.label}
        </label>
        <select
          id={id}
          name={name}
          className="select w-full"
          defaultValue={shown}
          aria-invalid={!!error}
          aria-describedby={describedBy}
        >
          <option value="">{field.optional ? "Not noted" : "Choose…"}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={`${id}-error`} className="text-error mt-1 text-sm">
            {error}
          </p>
        )}
      </div>
    );
  }

  const unit = fieldUnitLabel(field, units);
  return (
    <div>
      <label className="label mb-1 text-xs" htmlFor={id}>
        {field.label}
        {field.optional && " (optional)"}
      </label>
      <label className={`input w-full ${error ? "input-error" : unusual ? "input-warning" : ""}`}>
        <input
          id={id}
          name={name}
          type="number"
          inputMode={field.integer ? "numeric" : "decimal"}
          step={fieldStep(field, units)}
          defaultValue={shown}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          onChange={(e) => {
            const n = e.currentTarget.valueAsNumber;
            setUnusual(!Number.isNaN(n) && isUnusual(field, fromDisplay(field, n, units)));
          }}
        />
        {unit && <span className="label">{unit}</span>}
      </label>
      {error ? (
        <p id={`${id}-error`} className="text-error mt-1 text-sm">
          {error}
        </p>
      ) : (
        unusual && (
          <p id={`${id}-warn`} className="text-warning mt-1 text-sm">
            That's unusual. Double-check it before saving.
          </p>
        )
      )}
    </div>
  );
}
