import type { SyncDb } from "~/lib/sync";
import type { MedicationRow, RecipientRow } from "~/lib/sync/medications";

import { loadSchedulePasses } from "~/lib/sync/medicationPasses";
import { medicationsQuery, recipientQuery } from "~/lib/sync/medications";
import { readRows } from "~/lib/sync/timeline";

/** What the sheet is made from, as the page opens: the starting rows for `useWeeklySheet`'s live queries. */
export async function loadWeeklyData(db: SyncDb, groupId: string) {
  const [medicationRows, recipientRows, passRows] = await Promise.all([
    readRows<MedicationRow>(db, medicationsQuery(groupId)),
    readRows<RecipientRow>(db, recipientQuery(groupId)),
    loadSchedulePasses(db, groupId),
  ]);
  return { medicationRows, recipientRows, passRows };
}
