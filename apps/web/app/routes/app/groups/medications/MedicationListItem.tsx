import type { LocalMedication } from "~/lib/medications/medications.sync";

import { Plus } from "lucide-react";
import { useLocation } from "react-router";
import { MedicationCard } from "~/components/medications";
import { QuickTags } from "~/components/tags";
import { Badge, Button, Message } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { SHEET_LINK_STATE } from "~/lib/timeline/timelineSheet";
import { AsNeededLogButton, useAsNeededLog } from "./AsNeededLog";
import type { DueDoses, SchedulePass } from "@caretook/data/schema";
import { MEDICATION_TYPE_LABELS, medicationTypeBadge } from "@caretook/data/domain";
import { medicationSummaryLine, medicationTitle, stoppedText } from "@caretook/data/schema";

const NO_TAGS: readonly { id: string; name: string }[] = [];

/**
 * A medication in the list, as its `MedicationCard` (the whole card opens
 * its page): its name and strength, a badge with its type at the name's
 * right edge (none when it isn't set), its form, dose and schedule, and why
 * it's taken; a stopped one also says how and when. Writers get Log on a
 * current one: a scheduled medication opens the Dose sheet on it, over the
 * list (closing or saving it comes back to the list, search kept), an
 * as-needed one logs a dose now (asking first past its maximum, once
 * today's doses are known: `dueReady`). A stopped one has no Log. Its tags
 * show as `QuickTags` (two chips, then "+N"; × and Add tag for whoever may
 * tag it; tags-3), above the card's stretched link.
 */
export function MedicationListItem({
  medication,
  passes,
  canWrite,
  due,
  dueReady,
  tags,
}: {
  medication: LocalMedication;
  passes: readonly SchedulePass[];
  canWrite: boolean;
  /** Today's doses, for an as-needed Log's warnings. */
  due: DueDoses;
  dueReady: boolean;
  tags?: readonly { id: string; name: string }[];
}) {
  const stopped = stoppedText(medication);
  const badge = medicationTypeBadge(medication.type);
  const logging = useAsNeededLog(medication.groupId, due, medication);
  const canLog = canWrite && medication.status === "current";
  const title = medicationTitle(medication);
  const { search } = useLocation();

  const log = !canLog ? null : medication.schedule.type === "asNeeded" ? (
    dueReady && <AsNeededLogButton medication={medication} logging={logging} />
  ) : (
    <Button
      size="sm"
      icon={Plus}
      to={appUrls.medicationListDose(medication.groupId, medication.id, search)}
      state={SHEET_LINK_STATE}
      preventScrollReset
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
      <QuickTags
        target="medication"
        recordId={medication.id}
        label={title}
        createdBy={medication.createdBy}
        max={2}
        tags={tags ?? NO_TAGS}
        className="mt-0.5"
      />
    </MedicationCard>
  );
}
