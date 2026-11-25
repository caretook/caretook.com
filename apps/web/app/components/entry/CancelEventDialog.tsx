import { useState } from "react";
import { TIMELINE_LIMITS } from "@caretook/data/schema";
import { ConfirmDialog, Field } from "~/components/ui";

/**
 * Cancelling an event: a confirm with an optional reason ("Office called,
 * doctor out sick"). Enter in the reason confirms; "Keep it" and Escape
 * close without cancelling. The reason starts empty each time it opens.
 */
export function CancelEventDialog({
  open,
  onConfirm,
  onClose,
}: {
  open: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setReason("");
  }

  return (
    <ConfirmDialog
      open={open}
      title="Cancel this event?"
      message="It stays on the timeline, struck through and marked Cancelled, so everyone knows it isn't happening."
      confirmLabel="Cancel event"
      cancelLabel="Keep it"
      onConfirm={() => onConfirm(reason)}
      onClose={onClose}
    >
      <Field label="Reason">
        {(control) => (
          <input
            {...control}
            type="text"
            value={reason}
            maxLength={TIMELINE_LIMITS.cancelReason}
            placeholder="Office called, doctor out sick"
            autoComplete="off"
            enterKeyHint="done"
            data-cancel-reason
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onConfirm(reason);
              }
            }}
            className="input w-full"
          />
        )}
      </Field>
    </ConfirmDialog>
  );
}
