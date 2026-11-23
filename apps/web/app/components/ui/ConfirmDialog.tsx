import type { ReactNode } from "react";

import { useId, useRef } from "react";
import { Button } from "./Button";
import { useShowModal } from "./useShowModal";

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
 * - `children` (a field, such as a reason) go between the message and the
 *   buttons; `cancelLabel` renames the closing button ("Keep it" when the
 *   action itself is a cancel).
 */
export function ConfirmDialog({
  open,
  title,
  confirmLabel,
  message,
  confirmDisabled = false,
  cancelLabel = "Cancel",
  confirmVariant = "danger",
  children,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  message?: string | null;
  confirmDisabled?: boolean;
  cancelLabel?: string;
  /** The confirm button's look: solid red by default, for deletes; "primary" for a plain action. */
  confirmVariant?: "danger" | "primary";
  children?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();

  useShowModal(ref, open);

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
        {children && <div className="mt-3">{children}</div>}
        <div className="modal-action">
          <Button onClick={onClose}>{cancelLabel}</Button>
          <Button variant={confirmVariant} disabled={confirmDisabled} onClick={onConfirm} data-form-cancel="">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
