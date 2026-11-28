import type { RefObject } from "react";

import { useEffect } from "react";

/** A field the key would type into: `/` there types a slash. */
const typingIn = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || !!target.closest("input, textarea, select"));

/**
 * Inside another layer (a sheet, a dialog, a menu, a list box): its own keys
 * stay its own, and a second sheet never opens over it. The quick entry
 * sheet itself is let through, so Cmd/Ctrl+K there brings focus back to the box.
 */
const inOtherLayer = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false;
  const layer = target.closest('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]');
  return !!layer && !layer.querySelector("[data-quick-entry]");
};

/** Cmd+K (Mac) or Ctrl+K, no other modifier. */
const isCommandK = (e: KeyboardEvent) =>
  (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k";

/** `/` alone, outside a text field. */
const isSlash = (e: KeyboardEvent) =>
  e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !typingIn(e.target);

/** Focus the box once it has mounted (the sheet opens on the next render) and React Aria has moved focus in. */
function focusWhenThere(field: RefObject<HTMLTextAreaElement | null>, frames = 10) {
  requestAnimationFrame(() => {
    const el = field.current;
    if (el?.isConnected) {
      el.focus();
      if (document.activeElement === el) return;
    }
    if (frames > 1) focusWhenThere(field, frames - 1);
  });
}

/**
 * The quick entry keys, on every group page where the frame offers the sheet
 * (`on`: not in the easy frame): `/` outside a text field, and Cmd/Ctrl+K
 * from anywhere, fields included, call `open` and focus the box (`field`).
 * Listened for on `window` as the event bubbles, so a key a kit control
 * handled first (`preventDefault`) is left alone, as is one inside another
 * layer (`inOtherLayer`).
 */
export function useQuickEntryShortcut({
  on,
  open,
  field,
}: {
  on: boolean;
  open: () => void;
  field: RefObject<HTMLTextAreaElement | null>;
}) {
  useEffect(() => {
    if (!on) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || inOtherLayer(e.target)) return;
      if (!isCommandK(e) && !isSlash(e)) return;
      e.preventDefault();
      open();
      focusWhenThere(field);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [on, open, field]);
}
