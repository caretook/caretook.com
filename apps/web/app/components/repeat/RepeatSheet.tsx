import type { SeriesTiming } from "@caretook/data/series";
import type { RepeatChoice } from "~/lib/appointments/repeatChoice";
import type { RepeatKind } from "./RepeatField";

import { useState } from "react";
import { Sheet } from "~/components/ui";
import { repeatOutcome, RepeatField } from "./RepeatField";

/**
 * The repeat field in a sheet, over a new appointment or a todo's form: Done
 * keeps the choice (with its rule text, or null for Doesn't repeat), Cancel
 * and Escape leave it as it was. Done stays put while the choice can't be
 * saved (the preview says why).
 */
export function RepeatSheet({
  initial,
  timing,
  kind,
  onDone,
  onClose,
}: {
  initial: RepeatChoice;
  timing: Omit<SeriesTiming, "rule">;
  kind: RepeatKind;
  onDone: (choice: RepeatChoice, rule: string | null) => void;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState(initial);
  const { rule, problem } = repeatOutcome(choice, timing, kind);
  return (
    <Sheet isOpen onOpenChange={(open) => !open && onClose()} title="Repeat">
      <div className="space-y-4">
        <RepeatField choice={choice} onChange={setChoice} timing={timing} kind={kind} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            aria-disabled={problem ? true : undefined}
            onClick={() => !problem && onDone(choice, rule)}
          >
            Done
          </button>
        </div>
      </div>
    </Sheet>
  );
}
