import type { UnitChoices, VitalReading, VitalType } from "@caretook/data/schema";
import type { FieldIssue } from "~/lib/core/api";

import { VITALS } from "@caretook/data/schema";
import { vitalInputName } from "./entryFormData";
import { vitalFieldIssue } from "./formIssues";
import { VitalField } from "./VitalField";

/**
 * One reading of a vitals entry (the `index`th): its type's fields, straight
 * from the vitals spec, under the type's name, with Remove when `onRemove` is given.
 */
export function VitalReadingRow({
  type,
  index,
  stored,
  units,
  issues,
  onRemove,
}: {
  type: VitalType;
  index: number;
  /** The stored reading when editing (canonical units). */
  stored?: VitalReading;
  units: UnitChoices;
  issues: FieldIssue[];
  onRemove?: () => void;
}) {
  const spec = VITALS[type];
  const values = stored as Record<string, unknown> | undefined;
  return (
    <fieldset className="fieldset border-base-300 rounded-box border px-3 pb-3">
      <legend className="fieldset-legend flex w-full items-center justify-between gap-2">
        <span>{spec.label}</span>
        {onRemove && (
          <button type="button" className="btn btn-ghost btn-xs" onClick={onRemove}>
            Remove<span className="sr-only"> {spec.label.toLowerCase()}</span>
          </button>
        )}
      </legend>
      <input type="hidden" name={vitalInputName(index, "type")} value={type} />
      <div className={spec.fields.length > 1 ? "grid grid-cols-2 gap-2" : ""}>
        {spec.fields.map((field) => (
          <VitalField
            key={field.key}
            field={field}
            name={vitalInputName(index, field.key)}
            stored={values?.[field.key]}
            units={units}
            error={vitalFieldIssue(issues, index, field, units)}
          />
        ))}
      </div>
    </fieldset>
  );
}
