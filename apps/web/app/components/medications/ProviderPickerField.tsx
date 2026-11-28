import type { ProviderRole } from "~/lib/medications/medicationProviders";
import type { LocalProvider } from "~/lib/providers/providers.sync";

import { ProviderPickerField as Picker } from "~/components/providers";
import { fitsRole } from "~/lib/medications/medicationProviders";
import { FIELD } from "~/lib/medications/medicationFormData";

const ROLES = {
  prescriber: {
    name: FIELD.prescriberId,
    newName: FIELD.newPrescriber,
    legend: "Prescriber",
    chipsLabel: "Prescriber",
    noun: "prescriber",
    placeholder: "Search clinicians and practices",
    emptyText: "No clinicians or practices match",
    fits: (type: string) => fitsRole("prescriber", type),
  },
  pharmacy: {
    name: FIELD.pharmacyId,
    newName: FIELD.newPharmacy,
    legend: "Pharmacy",
    chipsLabel: "Pharmacy",
    noun: "pharmacy",
    placeholder: "Search pharmacies",
    emptyText: "No pharmacies match",
    fits: (type: string) => fitsRole("pharmacy", type),
  },
} satisfies Record<ProviderRole, object>;

/**
 * The prescriber or the pharmacy (the shared `ProviderPickerField`):
 * clinicians and practices prescribe, pharmacies fill. Posts `prescriberId`
 * or `newPrescriber` (and the pharmacy's).
 */
export function ProviderPickerField({
  kind: role,
  providers,
  initialId,
  error,
}: {
  /** Which one this is (not `role`, an ARIA attribute name). */
  kind: ProviderRole;
  providers: readonly LocalProvider[];
  initialId: string | null;
  error?: string;
}) {
  return (
    <Picker pickerId={role} {...ROLES[role]} providers={providers} initialId={initialId} error={error} />
  );
}
