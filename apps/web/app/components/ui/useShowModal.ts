import type { RefObject } from "react";

import { useEffect } from "react";

/**
 * Drives a native modal <dialog> from `open`: showModal() once no menu is
 * open (and a frame later), so a menu that opened it (an item in a ⋯ menu)
 * has closed and put focus back on its button first, which is where focus
 * returns when the dialog closes; close() when `open` turns false. Waits at
 * most about half a second for the menu.
 */
export function useShowModal(ref: RefObject<HTMLDialogElement | null>, open: boolean) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    // A closing menu leaves the DOM after its exit, then React Aria restores
    // its button's focus in the next frame.
    let frames = 0;
    let frame = 0;
    const show = () => {
      if (document.querySelector('[role="menu"]') && frames++ < 30) frame = requestAnimationFrame(show);
      else
        frame = requestAnimationFrame(() => {
          if (!dialog.open) dialog.showModal();
        });
    };
    frame = requestAnimationFrame(show);
    return () => cancelAnimationFrame(frame);
  }, [ref, open]);
}
