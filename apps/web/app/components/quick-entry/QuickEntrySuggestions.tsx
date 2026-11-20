import type { ReactNode } from "react";
import type { QuickEntryPass } from "@caretook/data/schema";
import type { DuePass } from "~/lib/duePasses";

import { ChipGroup } from "~/components/ui";
import { givePassText } from "~/lib/medicationDisplay";
import { useQuickEntrySuggestions } from "./useQuickEntrySuggestions";

/**
 * What goes under quick entry's field. While typing: the medication, pass
 * and provider names the last word starts (picking one completes it). With
 * the box empty: first the passes due now as one tap each ("Give evening
 * meds (4)": Given all, with Undo), then what the group usually logs around
 * now and your recent lines, as chips that only fill the box (Save is still
 * yours), then the tips (left out with `showTips={false}`, as simple mode does).
 */
export function QuickEntrySuggestions({
  groupId,
  text,
  onFill,
  passes,
  duePasses = [],
  onGivePass,
  passBusy = false,
  showTips = true,
}: {
  groupId: string;
  text: string;
  /** Put this in the box and leave the cursor at its end. */
  onFill: (text: string) => void;
  /** The group's passes, whose names are completed too. */
  passes?: readonly QuickEntryPass[];
  /** Today's named passes due now, offered first. */
  duePasses?: readonly DuePass[];
  /** Given all for a pass (its chip saves at once). */
  onGivePass?: (pass: DuePass) => void;
  passBusy?: boolean;
  /** The typing tips under the empty box (simple mode leaves them out). */
  showTips?: boolean;
}) {
  const { usual, recent, completions } = useQuickEntrySuggestions({ groupId, text, passes });

  if (text.trim()) {
    if (!completions.length) return null;
    return (
      <div data-quick-completions>
        <ChipGroup
          label="Matching names"
          actions={completions.map((c) => ({
            id: `${c.kind}:${c.id}`,
            label: c.name,
            onPress: () => onFill(c.text),
          }))}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2" data-quick-suggestions>
      {onGivePass && duePasses.length > 0 && (
        <Row caption="Due now" data="due">
          <ChipGroup
            label="Due now"
            actions={duePasses.map((pass) => ({
              id: pass.key,
              label: givePassText(pass),
              onPress: () => !passBusy && onGivePass(pass),
            }))}
          />
        </Row>
      )}
      {usual.length > 0 && (
        <Row caption="Usual around now" data="usual">
          <ChipGroup
            label="Usual around now"
            actions={usual.map((s) => ({ id: s.key, label: s.label, onPress: () => onFill(s.fill) }))}
          />
        </Row>
      )}
      {recent.length > 0 && (
        <Row caption="Your recent lines" data="recent">
          <ChipGroup
            label="Your recent lines"
            actions={recent.map((line) => ({ id: line, label: line, onPress: () => onFill(line) }))}
          />
        </Row>
      )}
      {showTips && (
        <p className="text-base-content/70 text-sm" data-quick-tips>
          Try “bp 130/85 hr 72”, “gave metformin”, “pain 4 left knee” or “appt Dr Lee Friday 2pm”. Commas
          separate entries; start with “n:” for a note.
        </p>
      )}
    </div>
  );
}

function Row({ caption, data, children }: { caption: string; data: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1" data-quick-row={data}>
      <span className="text-base-content/70 text-xs" aria-hidden="true">
        {caption}
      </span>
      {children}
    </div>
  );
}
