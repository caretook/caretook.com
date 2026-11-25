import type { SyncDb } from "~/lib/sync";
import type { DuePass } from "~/lib/medications/duePasses";
import type { DueDosesRows } from "~/lib/medications/dueDoses.sync";
import type { PassRow } from "~/lib/medications/medicationPasses.sync";
import type { MedicationRow } from "~/lib/medications/medications.sync";

import { useMemo } from "react";
import { useGroup } from "~/lib/app-shell/group";
import { scheduleZoneNote } from "~/lib/medications/medicationDisplay";
import { useDueDoses } from "~/lib/medications/dueDoses.sync";
import { duePasses } from "~/lib/medications/duePasses";
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

/**
 * Today's state of each named pass (Schedule's `DuePass`), by pass id, live,
 * and the recipient's zone it's read in (the cards' double-dose times);
 * `initial` is the loader's `loadDueDoses`.
 */
export function useTodayPasses(
  groupId: string,
  initial: DueDosesRows,
): { today: ReadonlyMap<string, DuePass>; timeZone: string } {
  const { due, passes, timeZone } = useDueDoses(groupId, initial);
  const today = useMemo(
    () => new Map(duePasses(due, passes).flatMap((p) => (p.passId ? [[p.passId, p] as const] : []))),
    [due, passes],
  );
  return { today, timeZone };
}
