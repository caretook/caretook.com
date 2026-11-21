import { useId, useRef } from "react";
import { useShowModal } from "~/components/ui";

/**
 * Delete on a repeating todo (planner-2): a native modal <dialog> with
 * "Skip this one" (this one goes, the next one comes), "Delete and stop
 * repeating" (it goes with no next), and Cancel (as Escape). It opens once
 * the ⋯ menu that asked has closed.
 */
export function RepeatDeleteDialog({
  open,
  title,
  onSkip,
  onStop,
  onClose,
}: {
  open: boolean;
  title: string;
  onSkip: () => void;
  onStop: () => void;
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
      aria-describedby={messageId}
      data-repeat-delete
    >
      <div className="modal-box">
        <h2 id={titleId} className="text-lg font-semibold">
          Delete this repeating todo?
        </h2>
        <p id={messageId} className="mt-2">
          Skip this one and the next “{title}” comes on its day, or delete it and stop repeating. Its notes
          are removed for everyone in the care group.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" className="btn btn-primary" onClick={onSkip} data-repeat-skip>
            Skip this one
          </button>
          <button type="button" className="btn btn-error btn-outline" onClick={onStop} data-repeat-stop>
            Delete and stop repeating
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}
