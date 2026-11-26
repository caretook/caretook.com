import type { FocusEvent, RefObject } from "react";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { IconButton, SURFACE } from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { dismissTips, takeTipsFocus } from "~/lib/assistant/quickEntryTips";
import { QUICK_ENTRY_EXAMPLES } from "./quickEntryCopy";

/** How soon after a press on the field, or a Tab, its focus counts as the user's own. */
const GESTURE_MS = 1000;

/**
 * When the tips panel shows: from a real focus of the field (a press on it,
 * or Tab), on the user's first `TIPS_FOCUSES` of them, until focus leaves
 * the field's wrapper (the X is inside it). A focus the app makes (autofocus,
 * Add an entry, the refocus after Save, a sheet or Suggestions closing) never
 * counts. It shows only while the box is `idle` (no card or names to show),
 * so a card or the names take its place, and it's back when they go. Spread
 * `field` on the textarea and `area` on the wrapper.
 */
export function useQuickEntryTips(field: RefObject<HTMLTextAreaElement | null>, idle: boolean) {
  const { userId } = useGroup();
  const [on, setOn] = useState(false);
  const pressedAt = useRef(-Infinity);
  const tabbedAt = useRef(-Infinity);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") tabbedAt.current = performance.now();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);
  return {
    visible: on && idle,
    field: {
      onPointerDown: () => {
        if (document.activeElement !== field.current) pressedAt.current = performance.now();
      },
      onFocus: () => {
        const now = performance.now();
        const real = now - pressedAt.current < GESTURE_MS || now - tabbedAt.current < GESTURE_MS;
        pressedAt.current = -Infinity;
        tabbedAt.current = -Infinity;
        if (real && idle && !on) setOn(takeTipsFocus(userId));
      },
    },
    area: {
      onBlur: (e: FocusEvent<HTMLElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOn(false);
      },
    },
    /** The X: gone for good, and focus stays in the box. */
    dismiss: () => {
      dismissTips(userId);
      field.current?.focus();
      setOn(false);
    },
  };
}

/**
 * "Why don't you try": the four example lines, the two shorthands and the
 * commas, floating under the field (inside its `relative` wrapper) so nothing
 * below moves; at phone width it scrolls inside itself. A press on it never
 * takes focus from the field. Its words are hidden from screen readers: the
 * box's description says the same (`QUICK_ENTRY_RULES`). It fades in like the
 * kit's overlays (`motion-overlay`; none under reduced motion).
 */
export function QuickEntryTips({ onDismiss }: { onDismiss: () => void }) {
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    // Two frames: the hidden first style is drawn before the fade starts.
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => setEntering(false));
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div
      className={`${SURFACE} motion-overlay absolute top-full right-0 left-0 z-20 mt-1 flex max-h-[50dvh] items-start gap-2 overflow-y-auto p-3`}
      data-quick-tips-panel=""
      data-entering={entering ? "" : undefined}
      role="presentation"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div aria-hidden="true" className="min-w-0 flex-1 space-y-2 text-sm">
        <p className="font-semibold">Why don’t you try</p>
        <ul className="space-y-1">
          {QUICK_ENTRY_EXAMPLES.map((line) => (
            <li key={line} className="font-mono break-words">
              {line}
            </li>
          ))}
        </ul>
        <p className="text-muted">
          <span className="font-mono">n:</span> for a note, <span className="font-mono">e:</span> for an
          event. Commas log several at once.
        </p>
      </div>
      <IconButton label="Hide these tips for good" icon={X} onPress={onDismiss} />
    </div>
  );
}
