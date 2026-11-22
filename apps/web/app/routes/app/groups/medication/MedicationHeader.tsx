import type { ReactNode } from "react";
import type { LocalMedication } from "~/lib/medications/medications.sync";

import { Pill } from "lucide-react";
import { Badge, DetailHeader, STATUS_TONE } from "~/components/ui";
import { FORM_LABELS, medicationTitle, STATUS_LABELS } from "~/lib/medications/medicationDisplay";

/**
 * The medication's header (`DetailHeader`): its name and strength, a
 * Completed or Discontinued badge once it's stopped, its form and dose.
 *
 * - `editors`: who is editing the notes now (avatars).
 * - `actions`: Edit (the edit sheet) and the status actions' ⋯ menu, for
 *   writers.
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
    <DetailHeader
      icon={Pill}
      tone={stopped ? "muted" : "primary"}
      title={medicationTitle(medication)}
      titleProps={{ "data-medication-name": "" }}
      badges={stopped && <Badge tone={STATUS_TONE.past}>{STATUS_LABELS[medication.status]}</Badge>}
      details={details.join(" · ")}
      editors={editors}
      actions={actions}
    />
  );
}
