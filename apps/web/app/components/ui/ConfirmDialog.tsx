import { useEffect, useId, useRef } from "react";

/**
 * A native modal <dialog>: the browser handles Escape, the inert background
 * and returning focus. `open` drives showModal()/close().
 *
 * - It opens once no menu is open (and a frame later), so a menu that opened
 *   it (Delete in a ⋯ menu) has closed and put focus back on its button
 *   first: that button is where focus returns when the dialog closes.
 * - Escape closes only the dialog, never a sheet it's in.
 * - `message` explains, and `confirmDisabled` holds back the confirm button
 *   (when the action can't go ahead yet; Cancel still closes).
 */
export function ConfirmDialog({
  open,
  title,
  confirmLabel,
  message,
  confirmDisabled = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  message?: string | null;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    // A closing menu leaves the DOM after its exit, then React Aria restores
    // its button's focus in the next frame. Waits at most about half a second.
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
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal"
      onClose={onClose}
      onKeyDown={(e) => e.key === "Escape" && e.stopPropagation()}
      aria-labelledby={titleId}
      aria-describedby={message ? messageId : undefined}
    >
      <div className="modal-box">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        {message && (
          <p id={messageId} className="mt-2">
            {message}
          </p>
        )}
        <div className="modal-action">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-error" disabled={confirmDisabled} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
