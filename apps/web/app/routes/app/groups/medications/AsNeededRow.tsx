import type { AsNeededToday, DueDoses } from "~/lib/dueDoses";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { ConfirmDialog } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { doseWarnings } from "~/lib/dueDoses";
import { asNeededCountText, doseWarningText, medicationTitle } from "~/lib/medicationDisplay";
import { useLogDose } from "./useLogDose";

/**
 * An as-needed medication's day: "2 of 4 today", and, for writers, Log (a
 * dose given now). Past the maximum it asks first, and still logs on
 * confirm.
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
  const [warning, setWarning] = useState<string | null>(null);
  const { medication } = item;
  const title = medicationTitle(medication);
  const give = () => log({ medicationId: medication.id, status: "given", amount: medication.dose });
  const tap = () => {
    const found = doseWarnings(due, { medicationId: medication.id, status: "given" }, new Date());
    if (found.length) setWarning(found.map((w) => doseWarningText(w, due.timeZone)).join(" "));
    else give();
  };

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2" data-as-needed={medication.id}>
      <div className="min-w-0 flex-1">
        <Link to={appUrls.medication(groupId, medication.id)} className="link-hover font-medium break-words">
          {title}
        </Link>
        <p className="text-base-content/70 text-sm" data-as-needed-count>
          {asNeededCountText(item)}
        </p>
      </div>
      {canWrite && (
        <button
          type="button"
          className="btn btn-sm"
          disabled={busy}
          aria-label={`Log a dose of ${title}`}
          data-log-as-needed
          onClick={tap}
        >
          <Plus className="size-4" aria-hidden="true" />
          Log
        </button>
      )}
      {error && (
        <p role="alert" className="text-error w-full text-sm">
          {error}
        </p>
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
    </li>
  );
}
