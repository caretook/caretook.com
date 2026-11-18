import type { UnitChoices, VitalReading, VitalType } from "@caretook/data/schema";
import type { FieldIssue } from "~/lib/api";

import { readingsIssue } from "./formIssues";
import { VitalReadingRow } from "./VitalReadingRow";
import { VitalTypeMenu } from "./VitalTypeMenu";

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
  const listIssue = readingsIssue(issues);
  return (
    <div className="space-y-2">
      {types.map((type, index) => (
        <VitalReadingRow
          key={type}
          type={type}
          index={index}
          stored={initial.find((r) => r.type === type)}
          units={units}
          issues={issues}
          onRemove={types.length > 1 ? () => onChange(types.filter((t) => t !== type)) : undefined}
        />
      ))}

      {listIssue && <p className="text-error text-sm">{listIssue}</p>}

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
