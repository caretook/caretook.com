import type { FocusEvent, KeyboardEvent, RefObject } from "react";
import type { Completion } from "~/lib/assistant/quickEntryCompletion";

import { useLayoutEffect, useRef, useState } from "react";
import { ChipGroup, SURFACE } from "~/components/ui";

/** The overlay's gap from the field, in px (Tailwind's `mb-1`). */
const GAP = 4;

/**
 * When the floating names show: while focus is in the field or on a name
 * chip (reached by Tab), until Escape, which hides them until the text
 * changes. Spread `area` on the wrapper that holds both; `onKeyDown` goes
 * on the field and the overlay, `onFieldKeyDown` on the field too, and
 * `overlayRef` on `QuickEntryCompletions`.
 */
export function useCompletionsOverlay(text: string, field: RefObject<HTMLTextAreaElement | null>) {
  const [focused, setFocused] = useState(false);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  return {
    open: focused && dismissedFor !== text,
    overlayRef,
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
    /**
     * Tab from the field while the names show: one name completes it (focus
     * stays in the field); several move focus to the first, for the arrows
     * and Enter. With none showing, Tab moves on as usual.
     */
    onFieldKeyDown: (
      e: KeyboardEvent,
      completions: readonly Completion[],
      onFill: (text: string) => void,
    ) => {
      if (e.key !== "Tab" || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
      const first = completions[0];
      const chips = overlayRef.current?.querySelectorAll("button");
      if (!first || !chips?.length) return;
      e.preventDefault();
      if (completions.length === 1) onFill(first.text);
      else chips[0]!.focus();
    },
  };
}

const ARROW_STEP: Partial<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/** Arrow keys move between the name chips (wrapping). */
function moveAmongChips(e: KeyboardEvent<HTMLElement>) {
  const step = ARROW_STEP[e.key];
  if (!step) return;
  const chips = [...e.currentTarget.querySelectorAll("button")];
  const at = chips.indexOf(document.activeElement as HTMLButtonElement);
  if (at < 0) return;
  e.preventDefault();
  chips[(at + step + chips.length) % chips.length]!.focus();
}

/**
 * "Matching names" while typing: the medication, pass and provider names
 * the last word starts, floating just **above** the field (inside its
 * `relative` wrapper), so the cards and the timeline under it stay in view
 * and nothing moves. With no room above it (the field near the top of the
 * screen), it opens under the field in the flow instead, pushing the cards
 * down rather than covering them. Picking one completes the word. A press
 * never takes focus from the field (so the overlay stays up until the press
 * lands); the box decides when it shows.
 */
export function QuickEntryCompletions({
  completions,
  onFill,
  onKeyDown,
  overlayRef,
}: {
  completions: readonly Completion[];
  /** Put this in the box and leave the cursor at its end. */
  onFill: (text: string) => void;
  /** `useCompletionsOverlay`'s Escape. */
  onKeyDown: (e: KeyboardEvent) => void;
  /** `useCompletionsOverlay`'s `overlayRef`, for its Tab. */
  overlayRef: RefObject<HTMLDivElement | null>;
}) {
  const [below, setBelow] = useState(false);
  useLayoutEffect(() => {
    const el = overlayRef.current;
    const anchor = el?.parentElement;
    if (!el || !anchor) return;
    setBelow(anchor.getBoundingClientRect().top < el.offsetHeight + GAP);
  }, [completions, overlayRef]);
  return (
    <div
      ref={overlayRef}
      className={`${SURFACE} ${below ? "relative mt-1" : "absolute right-0 bottom-full left-0 mb-1"} z-20 p-2`}
      data-quick-completions={below ? "below" : "above"}
      role="presentation"
      onKeyDown={(e) => {
        moveAmongChips(e);
        onKeyDown(e);
      }}
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
