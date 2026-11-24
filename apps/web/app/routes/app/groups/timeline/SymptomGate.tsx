import type { SymptomGateState } from "./useSymptomGate";

import { useEffect, useId, useRef } from "react";
import { Button } from "~/components/ui";

/**
 * The inline choice before a new symptom name is added (symptom-catalog
 * slice 3): the group's similar names, each "Use <name>", and "Add new" for
 * the name as typed. Focus moves to the first choice when it opens, unless
 * `takeFocus` is false (quick entry's card, which shows it while typing).
 */
export function SymptomGate({
  gate,
  onUse,
  onAddNew,
  size = "md",
  takeFocus = true,
}: {
  gate: SymptomGateState;
  onUse: (name: string) => void;
  onAddNew: () => void;
  size?: "md" | "lg";
  takeFocus?: boolean;
}) {
  const id = useId();
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (takeFocus) first.current?.focus();
  }, [gate, takeFocus]);
  return (
    <div
      role="group"
      aria-labelledby={id}
      className="rounded-box border-base-300 bg-base-200 space-y-2 border p-3"
      data-symptom-gate=""
    >
      <p id={id} className={size === "lg" ? "text-lg" : undefined}>
        The group already has a similar symptom. Use it, or add “{gate.name}” as new?
      </p>
      <div className="flex flex-wrap gap-2">
        {gate.similar.map((type, i) => (
          <Button
            key={type.id}
            ref={i === 0 ? first : undefined}
            variant="primary"
            size={size}
            onClick={() => onUse(type.name)}
            data-use-symptom={type.name}
          >
            Use {type.name}
          </Button>
        ))}
        <Button size={size} onClick={onAddNew} data-add-symptom="">
          Add new
        </Button>
      </div>
    </div>
  );
}
