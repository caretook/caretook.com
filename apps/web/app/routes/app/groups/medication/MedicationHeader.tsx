import type { ReactNode } from "react";
import type { LocalMedication } from "~/lib/medications/medications.sync";

import { Pill } from "lucide-react";
import { canTagRecord } from "@caretook/data/schema";
import { QuickTags, useRecordTags } from "~/components/tags";
import { Badge, DetailHeader, STATUS_TONE } from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { FORM_LABELS, medicationTitle, STATUS_LABELS } from "~/lib/medications/medicationDisplay";

/**
 * The medication's header (`DetailHeader`): its name and strength, a
 * Completed or Discontinued badge once it's stopped, its form and dose.
 *
 * - `editors`: who is editing the notes now (avatars).
 * - `actions`: Edit (the edit sheet) and the status actions' ⋯ menu, for
 *   writers.
 * - `showTags`: its tags under the details, live (`QuickTags`, tags-2): chips
 *   for every role, × and Add tag for whoever may tag it.
 */
export function MedicationHeader({
  medication,
  editors,
  actions,
  showTags = false,
}: {
  medication: LocalMedication;
  editors?: ReactNode;
  actions?: ReactNode;
  showTags?: boolean;
}) {
  const { role, userId } = useGroup();
  const tags = useRecordTags("medication", medication.id);
  const mayTag = canTagRecord(role, { target: "medication", createdBy: medication.createdBy }, userId);
  const stopped = medication.status !== "current";
  const details = [
    medication.form ? FORM_LABELS[medication.form] : null,
    medication.dose?.trim() || null,
  ].filter(Boolean);
  return (
    <DetailHeader
      icon={Pill}
      tone={stopped ? "muted" : "primary"}
      title={medicationTitle(medication)}
      titleProps={{ "data-medication-name": "" }}
      badges={stopped && <Badge tone={STATUS_TONE.past}>{STATUS_LABELS[medication.status]}</Badge>}
      details={
        showTags && (mayTag || tags.length > 0) ? (
          <>
            {details.join(" · ")}
            <QuickTags
              target="medication"
              recordId={medication.id}
              label={medicationTitle(medication)}
              createdBy={medication.createdBy}
              max={null}
              tags={tags}
              className="mt-1"
            />
          </>
        ) : (
          details.join(" · ")
        )
      }
      editors={editors}
      actions={actions}
    />
  );
}
