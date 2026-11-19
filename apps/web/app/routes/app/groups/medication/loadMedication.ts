import type { SyncDb } from "~/lib/sync";
import type { MedicationRow, RecipientRow } from "~/lib/sync/medications";
import type { ProviderRow } from "~/lib/sync/providers";
import type { EntryRow, MemberRow } from "~/lib/sync/timeline";

import { data } from "react-router";
import { loadAllergies } from "~/lib/sync/allergies";
import { loadSchedulePasses } from "~/lib/sync/medicationPasses";
import {
  medicationEntriesQuery,
  medicationQuery,
  recipientQuery,
  toMedication,
} from "~/lib/sync/medications";
import { providerQuery } from "~/lib/sync/providers";
import { membersQuery, readRows } from "~/lib/sync/timeline";

/**
 * The medication, its notes document and pending updates, its history (doses
 * and changes) and who wrote them, the group's passes, and the recipient (whose time zone the
 * schedule is in). A medication that isn't on the device, is deleted, or is
 * in another group is a 404 with no names. (The group route has already
 * turned away a non-member.)
 */
export async function loadMedication(db: SyncDb, groupId: string, medicationId: string) {
  const medicationRows = await readRows<MedicationRow>(db, medicationQuery(medicationId));
  const medication = medicationRows[0] ? toMedication(medicationRows[0]) : null;
  if (!medication || medication.groupId !== groupId || medication.deletedAt) {
    throw data("Not found", { status: 404 });
  }

  const [doc] = await readRows<{ id: string; snapshot: string | null }>(db, {
    sql: "SELECT id, snapshot FROM note_document WHERE id = ? AND group_id = ?",
    params: [medicationId, groupId],
  });
  const updates = doc
    ? await readRows<{ id: string; data: string | null }>(db, {
        sql: "SELECT id, data FROM note_update WHERE document_id = ?",
        params: [medicationId],
      })
    : [];
  const providerRows = (id: string | null) =>
    id ? readRows<ProviderRow>(db, providerQuery(id)) : Promise.resolve([]);
  const [historyRows, memberRows, recipientRows, prescriberRows, pharmacyRows, passRows, allergies] =
    await Promise.all([
      readRows<EntryRow>(db, medicationEntriesQuery(medicationId)),
      readRows<MemberRow>(db, membersQuery(groupId)),
      readRows<RecipientRow>(db, recipientQuery(groupId)),
      providerRows(medication.prescriberId),
      providerRows(medication.pharmacyId),
      loadSchedulePasses(db, groupId),
      loadAllergies(db, groupId),
    ]);

  return {
    medication,
    hasDocument: !!doc,
    initial: { snapshot: doc?.snapshot ?? null, updates },
    // Starting rows for the live queries (stable, so they don't reset each render).
    medicationRows,
    historyRows,
    memberRows,
    // The group's passes (deleted ones too), so the schedule and history read by pass name.
    passRows,
    // The prescriber and pharmacy as the page opens, so they show on the first render.
    providerRows: [...prescriberRows, ...pharmacyRows],
    recipientTimeZone: recipientRows[0]?.time_zone ?? null,
    // The recipient's allergies, shown above the details.
    allergies,
  };
}
