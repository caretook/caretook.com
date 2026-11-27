import type { ReactNode } from "react";

import { useEffect, useRef, useState } from "react";

/** What the editor's bar shows when it's full screen (B-962). */
export type NoteFullScreenOptions = {
  /** The dialog's name, and the title in the bar (what the note is attached to: the entry's heading). */
  title: string;
  /** Shown in the bar beside the title (the entry page's editor avatars). */
  aside?: ReactNode;
};

/**
 * The live note full screen (B-765): a native modal <dialog> over the page,
 * filling the screen edge to edge (above a phone's keyboard: the visual
 * viewport's height). `children` is the editor's frame, moved in while
 * `open`, which shows the title and `aside` in its own bar (B-962): the
 * editor instance, its Yjs document and its selection stay with the parent,
 * so only the frame remounts. Escape calls `onClose`.
 */
export function NoteFullScreen({
  open,
  title,
  children,
  onOpen,
  onClose,
}: Pick<NoteFullScreenOptions, "title"> & {
  open: boolean;
  children: ReactNode;
  /** Called once the dialog is shown (to put the cursor back in the note). */
  onOpen: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const viewport = useVisualViewport(open);
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      onOpenRef.current();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      {!open && children}
      <dialog
        ref={ref}
        aria-label={title}
        data-note-full-screen=""
        onClose={onClose}
        // Escape leaves full screen only, never a sheet the page is in.
        onKeyDown={(e) => e.key === "Escape" && e.stopPropagation()}
        // ProseMirror takes every Escape in the text (preventDefault), so the
        // browser never closes the dialog from there: close it here, unless the
        // mention popup is open (that Escape closes the popup).
        onKeyDownCapture={(e) => {
          const text = e.key === "Escape" && e.target instanceof Element && e.target.closest(".ProseMirror");
          if (text && !text.hasAttribute("aria-activedescendant")) onClose();
        }}
        style={viewport ? { top: viewport.top, height: viewport.height } : undefined}
        className="bg-base-200 text-base-content fixed inset-x-0 top-0 m-0 h-dvh max-h-none w-full max-w-none border-0 p-0"
      >
        {open && <div className="flex h-full flex-col">{children}</div>}
      </dialog>
    </>
  );
}

/** The visual viewport's top and height while `on` (it shrinks above a phone's keyboard). */
function useVisualViewport(on: boolean) {
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const vv = typeof window === "undefined" ? undefined : window.visualViewport;
    if (!on || !vv) return;
    const update = () => setBox({ top: vv.offsetTop, height: vv.height });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setBox(null);
    };
  }, [on]);
  return box;
}
