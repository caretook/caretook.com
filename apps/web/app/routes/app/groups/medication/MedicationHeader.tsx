import type { ReactNode } from "react";
import type { LocalMedication } from "~/lib/medications/medications.sync";

import { Pill } from "lucide-react";
import { TagChips, useRecordTags } from "~/components/tags";
import { Badge, DetailHeader, STATUS_TONE } from "~/components/ui";
import { FORM_LABELS, medicationTitle, STATUS_LABELS } from "~/lib/medications/medicationDisplay";

/**
 * The medication's header (`DetailHeader`): its name and strength, a
 * Completed or Discontinued badge once it's stopped, its form and dose.
 *
 * - `editors`: who is editing the notes now (avatars).
 * - `actions`: Edit (the edit sheet) and the status actions' ⋯ menu, for
 *   writers.
 * - `showTags`: its tag chips under the details, live, for every role (tags
 *   PRD; tagging is in the edit sheet).
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
  const tags = useRecordTags("medication", medication.id);
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
        showTags && tags.length > 0 ? (
          <>
            {details.join(" · ")}
            <TagChips tags={tags} max={null} className="mt-1" />
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
