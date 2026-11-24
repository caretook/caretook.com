import type { DueDoses } from "~/lib/medications/dueDoses";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button, ConfirmDialog } from "~/components/ui";
import { doseWarnings } from "~/lib/medications/dueDoses";
import { doseWarningText, medicationTitle } from "~/lib/medications/medicationDisplay";
import { useLogDose } from "./useLogDose";

type Medication = { id: string; name: string; strength: string | null; dose: string | null };

/**
 * An as-needed dose given now (Schedule's as-needed rows and the list): a tap
 * logs it, unless it would pass the maximum or follow one just given; then it
 * asks first (`warning`), and still logs on `confirm`. `error` is the save's.
 */
export function useAsNeededLog(groupId: string, due: DueDoses, medication: Medication) {
  const { log, busy, error } = useLogDose(groupId);
  const [warning, setWarning] = useState<string | null>(null);
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
