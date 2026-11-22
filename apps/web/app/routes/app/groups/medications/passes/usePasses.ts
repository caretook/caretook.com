import type { SyncDb } from "~/lib/sync";
import type { PassRow } from "~/lib/medications/medicationPasses.sync";
import type { MedicationRow } from "~/lib/medications/medications.sync";

import { useMemo } from "react";
import { useGroup } from "~/lib/app-shell/group";
import { scheduleZoneNote } from "~/lib/medications/medicationDisplay";
import { useLiveQuery } from "~/lib/sync";
import { passesQuery, passesWithMedications, toPasses } from "~/lib/medications/medicationPasses.sync";
import { medicationsQuery, toMedications } from "~/lib/medications/medications.sync";
import { readRows } from "~/lib/timeline/timeline.sync";

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

/** "Times are Los Angeles time", when this device is in another zone than the recipient (the tab and its sheets say it). */
export function usePassZoneNote() {
  const group = useGroup();
  return scheduleZoneNote(
    group.recipient?.timeZone ?? null,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
}
