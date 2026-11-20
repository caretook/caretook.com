import type { SyncDb } from "~/lib/sync";
import type { MedicationRow, RecipientRow } from "~/lib/medications/medications.sync";
import type { ProviderRow } from "~/lib/providers/providers.sync";

import { loadSchedulePasses } from "~/lib/medications/medicationPasses.sync";
import { medicationsQuery, recipientQuery } from "~/lib/medications/medications.sync";
import { providersQuery } from "~/lib/providers/providers.sync";
import { readRows } from "~/lib/timeline/timeline.sync";

/**
 * What the sheet is made from, as the page opens: the group's medications
 * (not deleted), its providers (deleted ones too, so a former prescriber
 * keeps their name), its recipient and its passes (deleted ones too). Starting rows for the live queries.
 */
export async function loadPrintData(db: SyncDb, groupId: string) {
  const [medicationRows, providerRows, recipientRows, passRows] = await Promise.all([
    readRows<MedicationRow>(db, medicationsQuery(groupId)),
    readRows<ProviderRow>(db, providersQuery(groupId, { includeDeleted: true })),
    readRows<RecipientRow>(db, recipientQuery(groupId)),
    loadSchedulePasses(db, groupId),
  ]);
  return { medicationRows, providerRows, recipientRows, passRows };
}
