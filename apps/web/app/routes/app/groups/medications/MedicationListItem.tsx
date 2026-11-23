import type { SchedulePass } from "~/lib/medications/medicationDisplay";
import type { LocalMedication } from "~/lib/medications/medications.sync";

import { Pill } from "lucide-react";
import { Link } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import {
  MEDICATION_TYPE_LABELS,
  medicationSummaryLine,
  medicationTitle,
  medicationTypeBadge,
  stoppedText,
} from "~/lib/medications/medicationDisplay";

/**
 * A medication in the list: its name and strength, a badge with its type at the row's right edge
 * (none when it isn't set), its form, dose and schedule, and why it's taken; a stopped one also says how and when. The
 * name is a link stretched over the row, so a tap anywhere opens its page.
 */
export function MedicationListItem({
  medication,
  passes,
}: {
  medication: LocalMedication;
  passes: readonly SchedulePass[];
}) {
  const stopped = stoppedText(medication);
  const badge = medicationTypeBadge(medication.type);
  return (
    <li
      className="hover:bg-base-200/50 relative isolate flex items-start gap-3 px-3 py-2.5"
      data-medication-id={medication.id}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${stopped ? "bg-base-200 text-base-content/60" : "bg-primary/15 text-primary"}`}
      >
        <Pill className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-start justify-between gap-2">
          <Link
            to={appUrls.medication(medication.groupId, medication.id)}
            className={`min-w-0 font-medium wrap-break-word outline-none before:absolute before:inset-0 focus-visible:before:outline-2 focus-visible:before:-outline-offset-2 ${stopped ? "text-base-content/70" : ""}`}
            data-medication-name
          >
            {medicationTitle(medication)}
          </Link>
          {badge && medication.type && (
            <span
              className="badge badge-ghost badge-sm mt-0.5 shrink-0"
              title={MEDICATION_TYPE_LABELS[medication.type]}
              data-medication-type={medication.type}
            >
              <span aria-hidden="true">{badge}</span>
              <span className="sr-only">{MEDICATION_TYPE_LABELS[medication.type]}</span>
            </span>
          )}
        </p>
        <p className="text-base-content/70 text-sm" data-medication-summary>
          {medicationSummaryLine(medication, passes)}
        </p>
        {medication.reason && (
          <p className="text-base-content/70 text-sm" data-medication-reason>
            <span className="sr-only">Reason: </span>
            {medication.reason}
          </p>
        )}
        {stopped && (
          <p className="text-base-content/70 text-sm" data-medication-stopped>
            {stopped}
          </p>
        )}
      </div>
    </li>
  );
}
