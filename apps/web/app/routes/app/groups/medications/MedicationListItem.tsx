import type { DueDoses } from "~/lib/medications/dueDoses";
import type { SchedulePass } from "~/lib/medications/medicationDisplay";
import type { LocalMedication } from "~/lib/medications/medications.sync";

import { Plus } from "lucide-react";
import { MedicationCard } from "~/components/medications";
import { Badge, Button, Message } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import {
  MEDICATION_TYPE_LABELS,
  medicationSummaryLine,
  medicationTitle,
  medicationTypeBadge,
  stoppedText,
} from "~/lib/medications/medicationDisplay";
import { AsNeededLogButton, useAsNeededLog } from "./AsNeededLog";

/**
 * A medication in the list, as its `MedicationCard` (the whole card opens
 * its page): its name and strength, a badge with its type at the name's
 * right edge (none when it isn't set), its form, dose and schedule, and why
 * it's taken; a stopped one also says how and when. Writers get Log on a
 * current one: a scheduled medication opens the Dose sheet on it, an
 * as-needed one logs a dose now (asking first past its maximum, once
 * today's doses are known: `dueReady`). A stopped one has no Log.
 */
export function MedicationListItem({
  medication,
  passes,
  canWrite,
  due,
  dueReady,
}: {
  medication: LocalMedication;
  passes: readonly SchedulePass[];
  canWrite: boolean;
  /** Today's doses, for an as-needed Log's warnings. */
  due: DueDoses;
  dueReady: boolean;
}) {
  const stopped = stoppedText(medication);
  const badge = medicationTypeBadge(medication.type);
  const logging = useAsNeededLog(medication.groupId, due, medication);
  const canLog = canWrite && medication.status === "current";
  const title = medicationTitle(medication);

  const log = !canLog ? null : medication.schedule.type === "asNeeded" ? (
    dueReady && <AsNeededLogButton medication={medication} logging={logging} />
  ) : (
    <Button
      size="sm"
      icon={Plus}
      to={appUrls.newDose(medication.groupId, { medicationId: medication.id })}
      aria-label={`Log a dose of ${title}`}
      data-log-dose=""
    >
      Log
    </Button>
  );

  return (
    <MedicationCard
      medication={medication}
      groupId={medication.groupId}
      stopped={!!stopped}
      data-medication-id={medication.id}
      badge={
        badge &&
        medication.type && (
          <span
            className="mt-0.5 flex shrink-0"
            title={MEDICATION_TYPE_LABELS[medication.type]}
            data-medication-type={medication.type}
          >
            <Badge>
              <span aria-hidden="true">{badge}</span>
              <span className="sr-only">{MEDICATION_TYPE_LABELS[medication.type]}</span>
            </Badge>
          </span>
        )
      }
      actions={log}
      notes={logging.error && <Message tone="error">{logging.error}</Message>}
    >
      <p className="text-muted text-sm" data-medication-summary>
        {medicationSummaryLine(medication, passes)}
      </p>
      {medication.reason && (
        <p className="text-muted text-sm" data-medication-reason>
          <span className="sr-only">Reason: </span>
          {medication.reason}
        </p>
      )}
      {stopped && (
        <p className="text-muted text-sm" data-medication-stopped>
          {stopped}
        </p>
      )}
    </MedicationCard>
  );
}
