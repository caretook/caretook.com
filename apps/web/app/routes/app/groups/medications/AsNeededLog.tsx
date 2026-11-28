import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { offerUndoToast, useUndoToast } from "~/components/medications";
import { Button, ConfirmDialog } from "~/components/ui";
import { doseUndoLabel } from "~/lib/medications/passUndo";
import { useLogDose } from "./useLogDose";
import type { DueDoses } from "@caretook/data/schema";
import { doseWarnings, doseWarningText, medicationTitle } from "@caretook/data/schema";

type Medication = { id: string; name: string; strength: string | null; dose: string | null };

/**
 * An as-needed dose given now (Schedule's as-needed rows and the list): a tap
 * logs it, unless it would pass the maximum or follow one just given; then it
 * asks first (`warning`), and still logs on `confirm`. `error` is the save's.
 * On the Schedule tab (`UndoToastProvider`) a save offers Undo as a toast
 * ("Tylenol logged · Undo").
 */
export function useAsNeededLog(groupId: string, due: DueDoses, medication: Medication) {
  const { log, busy, error, loggedId } = useLogDose(groupId);
  const [warning, setWarning] = useState<string | null>(null);
  const asToast = useUndoToast();
  const offered = useRef<string | null>(null);
  useEffect(() => {
    if (!asToast || !loggedId || offered.current === loggedId) return;
    offered.current = loggedId;
    offerUndoToast(groupId, doseUndoLabel(medication.name, "given"), [loggedId]);
  }, [asToast, loggedId, groupId, medication.name]);
  const give = () => log({ medicationId: medication.id, status: "given", amount: medication.dose });
  return {
    busy,
    error,
    warning,
    tap: () => {
      const found = doseWarnings(due, { medicationId: medication.id, status: "given" }, new Date());
      if (found.length) setWarning(found.map((w) => doseWarningText(w, due.timeZone)).join(" "));
      else give();
    },
    confirm: () => {
      setWarning(null);
      give();
    },
    cancel: () => setWarning(null),
  };
}

/** `useAsNeededLog`'s Log button and its "Log anyway?" confirm. */
export function AsNeededLogButton({
  medication,
  logging,
}: {
  medication: Medication;
  logging: ReturnType<typeof useAsNeededLog>;
}) {
  const title = medicationTitle(medication);
  return (
    <>
      <Button
        size="sm"
        icon={Plus}
        disabled={logging.busy}
        aria-label={`Log a dose of ${title}`}
        data-log-as-needed=""
        onClick={logging.tap}
      >
        Log
      </Button>
      <ConfirmDialog
        open={logging.warning !== null}
        title={`Log ${title} anyway?`}
        message={logging.warning}
        confirmLabel="Log anyway"
        onConfirm={logging.confirm}
        onClose={logging.cancel}
      />
    </>
  );
}
