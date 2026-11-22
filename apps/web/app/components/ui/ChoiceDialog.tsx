import { useId, useRef } from "react";
import { Button } from "./Button";
import { useShowModal } from "./useShowModal";

/**
 * A choice's look, from `Button`'s tones: the first is solid (`primary`, or
 * `danger` when the question is a delete), the rest `secondary` or
 * `dangerQuiet`.
 */
export type ChoiceTone = "primary" | "secondary" | "danger" | "dangerQuiet";

export type DialogChoice<Id extends string = string> = {
  id: Id;
  label: string;
  tone: ChoiceTone;
  /** Data hooks for tests and checks (`data-repeat-skip`). */
  [attr: `data-${string}`]: string | boolean | undefined;
};

/**
 * A question with two or three answers (ui-kit-2): a native modal <dialog>
 * with a title, a message, the choices stacked full width, then Cancel. It
 * follows `ConfirmDialog`'s rules (`useShowModal`): it opens once an open
 * menu has closed, so focus returns to that menu's button when it closes;
 * Escape closes only the dialog, never a sheet it's in. A choice calls
 * `onChoose` with its id and the caller closes it (`open` false). `onClose`
 * runs each time the dialog closes: Cancel, Escape, or after a choice once
 * the caller closes it. `data-*` go on the <dialog>.
 */
export function ChoiceDialog<Id extends string>({
  open,
  title,
  message,
  choices,
  cancelLabel,
  onChoose,
  onClose,
  ...data
}: {
  open: boolean;
  title: string;
  message: string;
  /** Up to three, in order. */
  choices: readonly DialogChoice<Id>[];
  cancelLabel: string;
  onChoose: (id: Id) => void;
  onClose: () => void;
  [attr: `data-${string}`]: string | boolean | undefined;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();
  useShowModal(ref, open);

  return (
    <dialog
      {...data}
      ref={ref}
      className="modal"
      onClose={onClose}
      onKeyDown={(e) => e.key === "Escape" && e.stopPropagation()}
      aria-labelledby={titleId}
      aria-describedby={messageId}
    >
      <div className="modal-box">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <p id={messageId} className="mt-2">
          {message}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {choices.slice(0, 3).map(({ id, label, tone, ...hooks }) => (
            <Button
              key={id}
              {...hooks}
              block
              // Secondary is Button's default look.
              variant={tone === "secondary" ? undefined : tone}
              onClick={() => onChoose(id)}
            >
              {label}
            </Button>
          ))}
          {/* Closing the <dialog> runs onClose (once, as Escape does). */}
          <Button block variant="ghost" onClick={() => ref.current?.close()}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
