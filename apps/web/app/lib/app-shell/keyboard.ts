// Whether a phone's on-screen keyboard is open (B-664): the tab bar hides
// while it is, so typing doesn't lift the bar over the content above the
// keyboard. Browsers don't say so directly; the rule reads a focused text
// field on a coarse pointer and a visual viewport that has shrunk.

import { useEffect, useState } from "react";

/** The visual viewport must be under this share of the layout height to count as a keyboard. */
export const KEYBOARD_SHRINK = 0.75;

/** `<input>` types that take no typing (no keyboard comes up for them). */
const NO_TYPING = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** Whether focus on `el` brings up a keyboard: a text input, a textarea or editable content. */
export function isTextEntry(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) return !NO_TYPING.has(el.type) && !el.readOnly && !el.disabled;
  return el instanceof HTMLElement && el.isContentEditable;
}

export type KeyboardSignals = {
  /** A text-entry element has focus. */
  textFocused: boolean;
  /** `(pointer: coarse)`: a touch screen is the main input. */
  coarse: boolean;
  /** The visual viewport's height (unzoomed), or null where `visualViewport` is missing. */
  viewportHeight: number | null;
  /** The height the page has with no keyboard. */
  layoutHeight: number;
};

/**
 * The keyboard is open when a text field has focus on a coarse pointer and the
 * visual viewport is well below the layout height; where there's no
 * `visualViewport`, the focus alone says so.
 */
export function keyboardOpen({
  textFocused,
  coarse,
  viewportHeight,
  layoutHeight,
}: KeyboardSignals): boolean {
  if (!textFocused || !coarse) return false;
  if (viewportHeight === null) return true;
  return viewportHeight < layoutHeight * KEYBOARD_SHRINK;
}

/**
 * `keyboardOpen` for a component, kept current on focus, viewport resizes and
 * pointer changes; false on the server and on desktop. The layout height is
 * the larger of `innerHeight` and the viewport's height last seen with no text
 * field focused, since a web view that resizes for the keyboard (Capacitor)
 * shrinks `innerHeight` too.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const coarse = window.matchMedia?.("(pointer: coarse)");
    const viewport = window.visualViewport;
    const height = () => (viewport ? viewport.height * viewport.scale : null);
    let focused = isTextEntry(document.activeElement);
    let resting = focused ? window.innerHeight : (height() ?? window.innerHeight);
    const update = () => {
      const viewportHeight = height();
      if (!focused && viewportHeight !== null) resting = viewportHeight;
      setOpen(
        keyboardOpen({
          textFocused: focused,
          coarse: coarse?.matches ?? false,
          viewportHeight,
          layoutHeight: Math.max(window.innerHeight, resting),
        }),
      );
    };
    const onFocusIn = (event: FocusEvent) => {
      focused = isTextEntry(event.target as Element | null);
      update();
    };
    // While focus moves between fields, `relatedTarget` is the next one.
    const onFocusOut = (event: FocusEvent) => {
      focused = isTextEntry(event.relatedTarget as Element | null);
      update();
    };
    update();
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    viewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    coarse?.addEventListener?.("change", update);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      viewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      coarse?.removeEventListener?.("change", update);
    };
  }, []);
  return open;
}
