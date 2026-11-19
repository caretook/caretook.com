import type { PrintRecipient } from "./printSheet";
import type { MedicationRow, RecipientRow } from "~/lib/sync/medications";
import type { ProviderRow } from "~/lib/sync/providers";

import { useMemo, useState } from "react";
import { useGroup } from "~/lib/group";
import { useLiveQuery } from "~/lib/sync";
import { medicationsQuery, recipientQuery, toMedications } from "~/lib/sync/medications";
import { providersQuery, toProviders } from "~/lib/sync/providers";
import { printSheet } from "./printSheet";

/** The sheet, live from the device: other members' changes show before it's printed. */
export function usePrintSheet(
  groupId: string,
  initial: { medicationRows: MedicationRow[]; providerRows: ProviderRow[]; recipientRows: RecipientRow[] },
) {
  const group = useGroup();
  // The day printed is the day the page opened.
  const [now] = useState(() => new Date());

  const meds = medicationsQuery(groupId);
  const medicationRows = useLiveQuery<MedicationRow>(meds.sql, meds.params, initial.medicationRows);
  const provs = providersQuery(groupId, { includeDeleted: true });
  const providerRows = useLiveQuery<ProviderRow>(provs.sql, provs.params, initial.providerRows);
  const rec = recipientQuery(groupId);
  const recipientRows = useLiveQuery<RecipientRow>(rec.sql, rec.params, initial.recipientRows);

  return useMemo(() => {
    const row = recipientRows[0];
    const recipient: PrintRecipient | null = row
      ? {
          name: row.name ?? "",
          preferredName: row.preferred_name,
          dateOfBirth: row.date_of_birth,
          timeZone: row.time_zone,
        }
      : null;
    return printSheet({
      recipient,
      groupName: group.name,
      medications: toMedications(medicationRows),
      providers: toProviders(providerRows),
      now,
    });
  }, [recipientRows, medicationRows, providerRows, group.name, now]);
}
