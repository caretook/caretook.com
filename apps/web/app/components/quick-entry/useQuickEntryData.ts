import type { QuickEntryMedication, QuickEntryMember, QuickEntryProvider } from "@caretook/data/schema";
import type { MedicationRow } from "~/lib/medications/medications.sync";
import type { ProviderRow } from "~/lib/providers/providers.sync";
import type { MemberRow } from "~/lib/timeline/timeline.sync";

import { useMemo } from "react";
import { useLiveQuery } from "~/lib/sync";
import { medicationsQuery, toMedications } from "~/lib/medications/medications.sync";
import { providersQuery, toProviders } from "~/lib/providers/providers.sync";
import { membersQuery } from "~/lib/timeline/timeline.sync";

const NO_ROWS: never[] = [];

/**
 * What quick entry matches names against, live from the device: the group's
 * current medications, its providers (not deleted) and its members (a
 * task's "for Sam"). Works offline.
 */
export function useQuickEntryData(groupId: string) {
  const meds = medicationsQuery(groupId, { status: "current" });
  const provs = providersQuery(groupId);
  const medicationRows = useLiveQuery<MedicationRow>(meds.sql, meds.params, NO_ROWS);
  const providerRows = useLiveQuery<ProviderRow>(provs.sql, provs.params, NO_ROWS);
  const mems = membersQuery(groupId);
  const memberRows = useLiveQuery<MemberRow>(mems.sql, mems.params, NO_ROWS);
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
    const members: QuickEntryMember[] = memberRows.flatMap((m) =>
      m.name?.trim() ? [{ id: m.user_id, name: m.name }] : [],
    );
    return { medications, providers, members };
  }, [medicationRows, providerRows, memberRows]);
}
