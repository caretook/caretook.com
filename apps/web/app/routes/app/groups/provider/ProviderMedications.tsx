import type { MedicationRow } from "~/lib/medications/medications.sync";
import type { GroupTagRow } from "~/lib/tags/tags.sync";

import { useMemo } from "react";
import { MedicationCard } from "~/components/medications";
import { QuickTags, useGroupRecordTags } from "~/components/tags";
import { List, Section } from "~/components/ui";
import { useLiveQuery } from "~/lib/sync";
import { useSchedulePasses } from "~/lib/medications/medicationPasses.sync";
import { providerMedicationsQuery, toMedications } from "~/lib/medications/medications.sync";
import { ROW_CHIPS } from "~/lib/tags/tagPicker";
import { medicationSummaryLine, medicationTitle } from "@caretook/data/schema";

const NO_ROWS: MedicationRow[] = [];
const NO_TAGS: readonly GroupTagRow[] = [];

/** What this provider does for it: "Prescribes", "Fills", or "Prescribes and fills". */
const roleLabel = (m: { prescriberId: string | null; pharmacyId: string | null }, providerId: string) => {
  const prescribes = m.prescriberId === providerId;
  const fills = m.pharmacyId === providerId;
  return prescribes && fills ? "Prescribes and fills" : prescribes ? "Prescribes" : fills ? "Fills" : "";
};

/**
 * The current medications this provider prescribes or fills, by name, live
 * (a medication added or stopped on another device shows without a
 * reload), each its `MedicationCard` opening its page: what the provider
 * does for it above the name, its dose and schedule under it, and its tags
 * (one live query for the region, never one per row). Nothing shows for a
 * provider with none.
 */
export function ProviderMedications({ groupId, providerId }: { groupId: string; providerId: string }) {
  const query = providerMedicationsQuery(groupId, providerId);
  const rows = useLiveQuery<MedicationRow>(query.sql, query.params, NO_ROWS);
  const medications = useMemo(() => toMedications(rows), [rows]);
  const passes = useSchedulePasses(groupId);
  const tags = useGroupRecordTags(groupId, "medication");
  if (medications.length === 0) return null;

  return (
    <Section title="Medications" id="medications" data-provider-medications="">
      <List>
        {medications.map((m) => (
          <MedicationCard
            key={m.id}
            medication={m}
            groupId={groupId}
            label={<span data-medication-role>{roleLabel(m, providerId)}</span>}
            data-medication-id={m.id}
          >
            <p className="text-muted text-sm" data-medication-summary>
              {medicationSummaryLine(m, passes)}
            </p>
            <QuickTags
              target="medication"
              recordId={m.id}
              label={medicationTitle(m)}
              createdBy={m.createdBy}
              max={ROW_CHIPS}
              tags={tags.get(m.id) ?? NO_TAGS}
              className="mt-1"
            />
          </MedicationCard>
        ))}
      </List>
    </Section>
  );
}
