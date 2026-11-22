import type { FocusEvent, KeyboardEvent, RefObject } from "react";
import type { Completion } from "~/lib/assistant/quickEntryCompletion";

import { useState } from "react";
import { ChipGroup, SURFACE } from "~/components/ui";

/**
 * When the floating names show: while focus is in the field or on a name
 * chip (reached by Tab), until Escape, which hides them until the text
 * changes. Spread `area` on the wrapper that holds both; `onKeyDown` goes
 * on the field and the overlay.
 */
export function useCompletionsOverlay(text: string, field: RefObject<HTMLTextAreaElement | null>) {
  const [focused, setFocused] = useState(false);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  return {
    open: focused && dismissedFor !== text,
    area: {
      onFocus: () => setFocused(true),
      onBlur: (e: FocusEvent<HTMLElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      },
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key !== "Escape" || dismissedFor === text) return;
      setDismissedFor(text);
      field.current?.focus();
    },
  };
}

/**
 * "Matching names" while typing: the medication, pass and provider names
 * the last word starts, floating just under the field (inside its
 * `relative` wrapper) over the cards and the timeline, so nothing below
 * moves. Picking one completes the word. A press never takes focus from the
 * field (so the overlay stays up until the press lands); the box decides
 * when it shows.
 */
export function QuickEntryCompletions({
  completions,
  onFill,
  onKeyDown,
}: {
  completions: readonly Completion[];
  /** Put this in the box and leave the cursor at its end. */
  onFill: (text: string) => void;
  /** `useCompletionsOverlay`'s Escape. */
  onKeyDown: (e: KeyboardEvent) => void;
}) {
  return (
    <div
      className={`${SURFACE} absolute top-full right-0 left-0 z-20 mt-1 p-2`}
      data-quick-completions
      role="presentation"
      onKeyDown={onKeyDown}
      onMouseDown={(e) => e.preventDefault()}
    >
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
