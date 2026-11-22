import type { MedicationRow } from "~/lib/medications/medications.sync";

import { Pill } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";
import { Section } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { medicationSummaryLine, medicationTitle } from "~/lib/medications/medicationDisplay";
import { useLiveQuery } from "~/lib/sync";
import { useSchedulePasses } from "~/lib/medications/medicationPasses.sync";
import { providerMedicationsQuery, toMedications } from "~/lib/medications/medications.sync";

const NO_ROWS: MedicationRow[] = [];

/**
 * The current medications this provider prescribes or fills, by name, live
 * (a medication added or stopped on another device shows without a
 * reload). Each opens its medication page. Nothing shows for a provider
 * with none.
 */
export function ProviderMedications({ groupId, providerId }: { groupId: string; providerId: string }) {
  const query = providerMedicationsQuery(groupId, providerId);
  const rows = useLiveQuery<MedicationRow>(query.sql, query.params, NO_ROWS);
  const medications = useMemo(() => toMedications(rows), [rows]);
  const passes = useSchedulePasses(groupId);
  if (medications.length === 0) return null;

  return (
    <Section title="Medications" id="medications" data-provider-medications="">
      <ul className="rounded-box border-base-300 bg-base-100 divide-base-200 divide-y overflow-hidden border">
        {medications.map((m) => {
          const roles = [
            m.prescriberId === providerId && "Prescribes",
            m.pharmacyId === providerId && "Fills",
          ].filter(Boolean);
          return (
            <li key={m.id}>
              <Link
                to={appUrls.medication(groupId, m.id)}
                className="hover:bg-base-200/50 flex items-center gap-3 px-3 py-2.5"
                data-medication-id={m.id}
              >
                <span
                  aria-hidden="true"
                  className="bg-primary/15 text-primary grid size-8 shrink-0 place-items-center rounded-full"
                >
                  <Pill className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium" data-medication-name>
                    {medicationTitle(m)}
                  </span>
                  <span className="text-base-content/70 block text-sm">
                    <span data-medication-role>{roles.join(" and ")}</span>
                    {" · "}
                    {medicationSummaryLine(m, passes)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
