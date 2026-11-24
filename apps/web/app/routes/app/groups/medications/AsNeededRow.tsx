import type { AsNeededToday, DueDoses } from "~/lib/medications/dueDoses";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Button, ConfirmDialog, ListRow, Message } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { doseWarnings } from "~/lib/medications/dueDoses";
import { useMedicationLinkState } from "~/lib/medications/medicationOrigin";
import { ExtraDoseWarning } from "~/components/medications";
import {
  asNeededCountText,
  doseWarningText,
  medicationTitle,
  overMaxText,
} from "~/lib/medications/medicationDisplay";
import { useLogDose } from "./useLogDose";

/**
 * An as-needed medication's day: "2 of 4 today", and, for writers, Log (a
 * dose given now). Past the maximum it asks first, and still logs on
 * confirm; once past it, it says so with each time.
 */
export function AsNeededRow({
  item,
  due,
  groupId,
  canWrite,
}: {
  item: AsNeededToday;
  due: DueDoses;
  groupId: string;
  canWrite: boolean;
}) {
  const { log, busy, error } = useLogDose(groupId);
  const linkState = useMedicationLinkState();
  const [warning, setWarning] = useState<string | null>(null);
  const { medication } = item;
  const title = medicationTitle(medication);
  const over = overMaxText(item, due.timeZone);
  const give = () => log({ medicationId: medication.id, status: "given", amount: medication.dose });
  const tap = () => {
    const found = doseWarnings(due, { medicationId: medication.id, status: "given" }, new Date());
    if (found.length) setWarning(found.map((w) => doseWarningText(w, due.timeZone)).join(" "));
    else give();
  };

  return (
    <ListRow className="flex flex-wrap items-center gap-x-3 gap-y-1" data-as-needed={medication.id}>
      <div className="min-w-0 flex-1">
        <Link
          to={appUrls.medication(groupId, medication.id)}
          state={linkState}
          className="link-hover font-medium break-words"
        >
          {title}
        </Link>
        <p className="text-muted text-sm" data-as-needed-count>
          {asNeededCountText(item)}
        </p>
      </div>
      {canWrite && (
        <Button
          size="sm"
          icon={Plus}
          disabled={busy}
          aria-label={`Log a dose of ${title}`}
          data-log-as-needed=""
          onClick={tap}
        >
          Log
        </Button>
      )}
      {over && <ExtraDoseWarning text={over} className="w-full" />}
      {error && (
        <Message tone="error" className="w-full">
          {error}
        </Message>
      )}
      {canWrite && (
        <ConfirmDialog
          open={warning !== null}
          title={`Log ${title} anyway?`}
          message={warning}
          confirmLabel="Log anyway"
          onConfirm={() => {
            setWarning(null);
            give();
          }}
          onClose={() => setWarning(null)}
        />
      )}
    </ListRow>
  );
}
