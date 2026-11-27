import type { SymptomDefault } from "./quickEntryCards";

import { useId } from "react";
import { ChipGroup } from "~/components/ui";

/**
 * A symptom card's default (symptom-catalog-2): the typed name is like
 * names the group has, so the card saves as the closest one ("Saves as
 * Knee pain"), with the others and the name as typed one tap away, as the
 * card's other readings are (`ChipGroup`). It never stops Save or takes
 * focus: the timeline's sheet asks instead (`SymptomGate`), but a quick
 * line goes ahead.
 */
export function QuickEntrySymptomDefault({
  symptom,
  onChoose,
}: {
  symptom: SymptomDefault;
  /** The catalog's name to use, or null to add the name as typed. */
  onChoose: (use: string | null) => void;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="mt-2 space-y-1.5 text-sm" data-symptom-default="">
      <p id={id} className="text-muted">
        Saves as <span className="text-base-content font-medium">{symptom.using}</span>
      </p>
      <ChipGroup
        label={`Other names for “${symptom.typed}”`}
        actions={[
          ...symptom.others.map((type) => ({
            id: type.id,
            label: `Use ${type.name}`,
            onPress: () => onChoose(type.name),
          })),
          { id: "new", label: `Add “${symptom.typed}” as new`, onPress: () => onChoose(null) },
        ]}
      />
    </div>
  );
}
