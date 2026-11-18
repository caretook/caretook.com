import type { TimelineEntryKind, VitalType } from "@caretook/data/schema";

import { VitalTypeMenu } from "./VitalTypeMenu";

/**
 * A new entry's kind: Symptom, or Vitals (a menu that also picks the first
 * reading). Notes and events are written in their own editor, not here.
 * Posts `kind`.
 */
export function EntryKindPicker({
  kind,
  onSymptom,
  onVital,
}: {
  kind: TimelineEntryKind;
  onSymptom: () => void;
  onVital: (type: VitalType) => void;
}) {
  return (
    <fieldset className="fieldset">
      <legend className="fieldset-legend">What happened?</legend>
      <div className="join">
        <input
          type="radio"
          name="kind"
          value="symptom"
          aria-label="Symptom"
          checked={kind === "symptom"}
          onChange={onSymptom}
          className="join-item btn btn-sm"
        />
        <VitalTypeMenu
          className={`join-item btn btn-sm ${kind === "vital" ? "btn-neutral" : ""}`}
          onSelect={onVital}
        >
          Vitals <span aria-hidden="true">▾</span>
        </VitalTypeMenu>
      </div>
      {kind === "vital" && <input type="hidden" name="kind" value="vital" />}
    </fieldset>
  );
}
