import type { ReactNode } from "react";
import type { DuePass } from "~/lib/medications/duePasses";
import type { UsualSuggestion } from "~/lib/assistant/quickEntryPredictions";

import { ChipGroup } from "~/components/ui";
import { givePassText } from "~/lib/medications/medicationDisplay";

/**
 * The suggestions popover's body, for an empty box: first the passes due
 * now as one tap each ("Give evening meds (4)": Given all, with Undo), then
 * what the group usually logs around now and your recent lines, as chips
 * that only fill the box (Save is still yours). Every chip closes the
 * popover once it's done.
 */
export function QuickEntrySuggestions({
  usual,
  recent,
  duePasses = [],
  onFill,
  onGivePass,
  passBusy = false,
  close,
}: {
  usual: readonly UsualSuggestion[];
  recent: readonly string[];
  /** Today's named passes due now, offered first (only with `onGivePass`). */
  duePasses?: readonly DuePass[];
  /** Put this in the box and leave the cursor at its end. */
  onFill: (text: string) => void;
  /** Given all for a pass (its chip saves at once). */
  onGivePass?: (pass: DuePass) => void;
  passBusy?: boolean;
  /** Close the popover. */
  close: () => void;
}) {
  const fill = (text: string) => {
    onFill(text);
    close();
  };
  return (
    <div className="space-y-3" data-quick-suggestions>
      {onGivePass && duePasses.length > 0 && (
        <Row caption="Due now" data="due">
          <ChipGroup
            label="Due now"
            actions={duePasses.map((pass) => ({
              id: pass.key,
              label: givePassText(pass),
              onPress: () => {
                if (passBusy) return;
                onGivePass(pass);
                close();
              },
            }))}
          />
        </Row>
      )}
      {usual.length > 0 && (
        <Row caption="Usual around now" data="usual">
          <ChipGroup
            label="Usual around now"
            actions={usual.map((s) => ({ id: s.key, label: s.label, onPress: () => fill(s.fill) }))}
          />
        </Row>
      )}
      {recent.length > 0 && (
        <Row caption="Your recent lines" data="recent">
          <ChipGroup
            label="Your recent lines"
            actions={recent.map((line) => ({ id: line, label: line, onPress: () => fill(line) }))}
          />
        </Row>
      )}
    </div>
  );
}

function Row({ caption, data, children }: { caption: string; data: string; children: ReactNode }) {
  return (
    <div className="space-y-1" data-quick-row={data}>
      <p className="text-muted text-xs" aria-hidden="true">
        {caption}
      </p>
      {children}
    </div>
  );
}
