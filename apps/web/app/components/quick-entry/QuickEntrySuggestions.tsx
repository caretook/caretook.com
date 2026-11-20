import type { ReactNode } from "react";

import { ChipGroup } from "~/components/ui";
import { useQuickEntrySuggestions } from "./useQuickEntrySuggestions";

/**
 * What goes under quick entry's field. While typing: the medication and
 * provider names the last word starts (picking one completes it). With the
 * box empty: what the group usually logs around now and your recent lines,
 * as chips that only fill the box (Save is still yours), then the tips.
 */
export function QuickEntrySuggestions({
  groupId,
  text,
  onFill,
}: {
  groupId: string;
  text: string;
  /** Put this in the box and leave the cursor at its end. */
  onFill: (text: string) => void;
}) {
  const { usual, recent, completions } = useQuickEntrySuggestions({ groupId, text });

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
      <p className="text-base-content/70 text-sm" data-quick-tips>
        Try “bp 130/85 hr 72”, “gave metformin”, “pain 4 left knee” or “appt Dr Lee Friday 2pm”. Commas
        separate entries; start with “n:” for a note.
      </p>
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
