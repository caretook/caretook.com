import type { QuickEntryMedication, QuickEntryProvider } from "@caretook/data/schema";
import type { MedicationRow } from "~/lib/sync/medications";
import type { ProviderRow } from "~/lib/sync/providers";

import { useMemo } from "react";
import { useLiveQuery } from "~/lib/sync";
import { medicationsQuery, toMedications } from "~/lib/sync/medications";
import { providersQuery, toProviders } from "~/lib/sync/providers";

const NO_ROWS: never[] = [];

/**
 * What quick entry matches names against, live from the device: the group's
 * current medications and its providers (not deleted). Works offline.
 */
export function useQuickEntryData(groupId: string) {
  const meds = medicationsQuery(groupId, { status: "current" });
  const provs = providersQuery(groupId);
  const medicationRows = useLiveQuery<MedicationRow>(meds.sql, meds.params, NO_ROWS);
  const providerRows = useLiveQuery<ProviderRow>(provs.sql, provs.params, NO_ROWS);
  return useMemo(() => {
    const medications: QuickEntryMedication[] = toMedications(medicationRows).map((m) => ({
      id: m.id,
      name: m.name,
      strength: m.strength,
      dose: m.dose,
      directions: m.directions,
      reason: m.reason,
    }));
    const providers: QuickEntryProvider[] = toProviders(providerRows).map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      address: p.address,
    }));
    return { medications, providers };
  }, [medicationRows, providerRows]);
}
