import type { SyncDb } from "~/lib/sync";
import type { PassRow } from "~/lib/sync/medicationPasses";
import type { MedicationRow } from "~/lib/sync/medications";

import { useMemo } from "react";
import { useLiveQuery } from "~/lib/sync";
import { passesQuery, passesWithMedications, toPasses } from "~/lib/sync/medicationPasses";
import { medicationsQuery, toMedications } from "~/lib/sync/medications";
import { readRows } from "~/lib/sync/timeline";

// The Passes screen's data: the group's live passes in the day's order, each
// with the current medications in it, read locally (so it works offline) and
// live (another device's change shows without a reload).

export type PassesRows = { passes: PassRow[]; medications: MedicationRow[] };

/** The loader's first read, so the screen renders complete before the live queries take over. */
export async function loadPasses(db: SyncDb, groupId: string): Promise<PassesRows> {
  const [passes, medications] = await Promise.all([
    readRows<PassRow>(db, passesQuery(groupId)),
    readRows<MedicationRow>(db, medicationsQuery(groupId)),
  ]);
  return { passes, medications };
}

export function usePasses(groupId: string, initial: PassesRows) {
  const passesQ = passesQuery(groupId);
  const passRows = useLiveQuery<PassRow>(passesQ.sql, passesQ.params, initial.passes);
  const medicationsQ = medicationsQuery(groupId);
  const medicationRows = useLiveQuery<MedicationRow>(
    medicationsQ.sql,
    medicationsQ.params,
    initial.medications,
  );
  return useMemo(
    () => passesWithMedications(toPasses(passRows), toMedications(medicationRows)),
    [passRows, medicationRows],
  );
}
