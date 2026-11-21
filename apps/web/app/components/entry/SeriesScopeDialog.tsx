import type { SeriesScope } from "@caretook/data/series";
import type { SeriesAction } from "~/lib/appointments/seriesScope";

import { useId, useRef } from "react";
import { useShowModal } from "~/components/ui";
import { scopeQuestion } from "~/lib/appointments/seriesScope";

/**
 * The question before a change to a series visit (appointments-2): a native
 * modal <dialog> with Only this visit, This and later visits, and Cancel
 * (as Escape). It opens once the ⋯ menu that asked has closed.
 */
export function SeriesScopeDialog({
  open,
  action,
  kind,
  onChoose,
  onClose,
}: {
  open: boolean;
  action: SeriesAction;
  /** The visit's kind: "event" (an appointment) or "note" (a reminder). */
  kind: string;
  onChoose: (scope: SeriesScope) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();
  useShowModal(ref, open);
  const { title, message } = scopeQuestion(action, kind);
  const danger = action === "delete" || action === "cancel";

  return (
    <dialog
      ref={ref}
      className="modal"
      onClose={onClose}
      onKeyDown={(e) => e.key === "Escape" && e.stopPropagation()}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      data-series-scope={action}
    >
      <div className="modal-box">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <p id={messageId} className="mt-2">
          {message}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            className={`btn ${danger ? "btn-error" : "btn-primary"}`}
            onClick={() => onChoose("only")}
          >
            Only this visit
          </button>
          <button
            type="button"
            className={`btn ${danger ? "btn-error btn-outline" : "btn-primary btn-outline"}`}
            onClick={() => onChoose("later")}
          >
            This and later visits
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}
