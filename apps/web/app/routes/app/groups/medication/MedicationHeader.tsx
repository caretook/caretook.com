import type { ReactNode } from "react";
import type { LocalMedication } from "~/lib/sync/medications";

import { Pill } from "lucide-react";
import { FORM_LABELS, medicationTitle, STATUS_LABELS } from "~/lib/medicationDisplay";

/**
 * The medication's header, in regions like `ProviderHeader`'s:
 *
 *   [icon] [name strength, badge ...] [editors] [actions]
 *          [form · dose · reason]
 *
 * - `editors`: who is editing the notes now (avatars).
 * - `actions`: Edit (the edit sheet) and the status actions' ⋯ menu, for
 *   writers.
 *
 * Empty regions take no space.
 */
export function MedicationHeader({
  medication,
  editors,
  actions,
}: {
  medication: LocalMedication;
  editors?: ReactNode;
  actions?: ReactNode;
}) {
  const stopped = medication.status !== "current";
  const details = [
    medication.form ? FORM_LABELS[medication.form] : null,
    medication.dose?.trim() || null,
  ].filter(Boolean);
  return (
    <header className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={`grid size-9 shrink-0 place-items-center rounded-full ${stopped ? "bg-base-200 text-base-content/60" : "bg-primary/15 text-primary"}`}
      >
        <Pill className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div data-region="title" className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="text-xl font-semibold wrap-break-word" data-medication-name>
            {medicationTitle(medication)}
          </h1>
          {stopped && <span className="badge badge-ghost badge-sm">{STATUS_LABELS[medication.status]}</span>}
        </div>
        {details.length > 0 && (
          <p data-region="details" className="text-base-content/70 text-sm">
            {details.join(" · ")}
          </p>
        )}
      </div>
      {editors && (
        <div data-region="editors" className="flex shrink-0 items-center -space-x-1.5 pt-1">
          {editors}
        </div>
      )}
      {actions && (
        <div data-region="actions" className="flex shrink-0 items-center gap-1">
          {actions}
        </div>
      )}
    </header>
  );
}
