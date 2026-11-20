import type { MedicationStatus } from "@caretook/data/schema";
import type { MedicationList as Listed } from "~/lib/medications/medicationList";
import type { SchedulePass } from "~/lib/medications/medicationDisplay";
import type { LocalMedication } from "~/lib/medications/medications.sync";

import { STATUS_LABELS } from "~/lib/medications/medicationDisplay";
import { MedicationListItem } from "./MedicationListItem";

const countLabel = (n: number) => `${n} ${n === 1 ? "medication" : "medications"}`;

function Rows({
  medications,
  passes,
  label,
}: {
  medications: LocalMedication[];
  passes: readonly SchedulePass[];
  label: string;
}) {
  return (
    <ul
      aria-label={label}
      className="rounded-box border-base-300 bg-base-100 divide-base-200 divide-y overflow-hidden border"
    >
      {medications.map((m) => (
        <MedicationListItem key={m.id} medication={m} passes={passes} />
      ))}
    </ul>
  );
}

/**
 * The medication list: current medications first, then the completed and
 * discontinued ones below, or why nothing shows. A status line announces how
 * many match after each search or filter. The route composes it (a Today
 * section goes above it later).
 */
export function MedicationList({
  total,
  list,
  passes,
  text,
  status,
}: {
  /** Every medication in the group (not deleted), before filtering. */
  total: number;
  list: Listed<LocalMedication>;
  /** The group's passes, deleted ones too: schedules read by pass name. */
  passes: readonly SchedulePass[];
  /** What's typed in the search box. */
  text: string;
  status: MedicationStatus | null;
}) {
  const shown = list.current.length + list.stopped.length;
  const what = status ? `${STATUS_LABELS[status].toLowerCase()} medications` : "medications";
  return (
    <>
      <p role="status" className="sr-only">
        {total === 0 ? "" : countLabel(shown)}
      </p>

      <section aria-labelledby="medications-heading" className="space-y-4" data-medication-list>
        <h2 id="medications-heading" className="sr-only">
          {status ? `${STATUS_LABELS[status]} medications` : "All medications"}
        </h2>

        {total === 0 ? (
          <p className="text-base-content/70">No medications yet.</p>
        ) : (
          shown === 0 && (
            <p className="text-base-content/70" data-empty>
              {text.trim() ? `No ${what} match “${text.trim()}”.` : `No ${what}.`}
            </p>
          )
        )}

        {list.current.length > 0 && (
          <Rows medications={list.current} label="Current medications" passes={passes} />
        )}

        {list.stopped.length > 0 && (
          <section aria-labelledby={status ? undefined : "stopped-heading"} className="space-y-2">
            {!status && (
              <h3 id="stopped-heading" className="text-base-content/70 text-sm font-semibold">
                Completed and discontinued
              </h3>
            )}
            <Rows
              medications={list.stopped}
              passes={passes}
              label={
                status ? `${STATUS_LABELS[status]} medications` : "Completed and discontinued medications"
              }
            />
          </section>
        )}
      </section>
    </>
  );
}
