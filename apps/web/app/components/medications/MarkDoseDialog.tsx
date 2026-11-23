import type { MarkStatus } from "./DoseSlotRow";
import type { DoseSlot } from "~/lib/medications/dueDoses";

import { useState } from "react";
import { MEDICATION_LIMITS } from "@caretook/data/schema";
import { ConfirmDialog, Field } from "~/components/ui";
import { clockTime, medicationTitle } from "~/lib/medications/medicationDisplay";
import { usePassLog } from "./usePassLog";

/** A slot being marked Skipped or Refused, in its pass's round when it's in one. */
export type Marking = { slot: DoseSlot; status: MarkStatus; passLogId?: string | null };

/**
 * Skipped or Refused, with an optional note: asks, then logs it now for the
 * slot (joining `passLogId`'s round). Closes once the write is through; a
 * refusal stays, with its message.
 */
export function MarkDoseDialog({
  marking,
  groupId,
  onClose,
}: {
  marking: Marking | null;
  groupId: string;
  onClose: () => void;
}) {
  const { logSlot, busy, error } = usePassLog(groupId);
  const [note, setNote] = useState("");

  const label = marking?.status === "refused" ? "Refused" : "Skipped";
  return (
    <ConfirmDialog
      open={marking !== null}
      title={
        marking
          ? `${label}: ${medicationTitle(marking.slot.medication)}, ${clockTime(marking.slot.time)}`
          : ""
      }
      message={error}
      confirmLabel={`Mark ${label.toLowerCase()}`}
      confirmDisabled={busy}
      onConfirm={() => {
        if (!marking) return;
        void logSlot(marking.slot, marking.status, { note, passLogId: marking.passLogId }).then((ok) => {
          if (!ok) return;
          setNote("");
          onClose();
        });
      }}
      onClose={() => {
        setNote("");
        onClose();
      }}
    >
      <Field label="Note (optional)" kind="textarea">
        {(control) => (
          <textarea
            {...control}
            rows={2}
            maxLength={MEDICATION_LIMITS.doseNote}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            data-mark-note
          />
        )}
      </Field>
    </ConfirmDialog>
  );
}
