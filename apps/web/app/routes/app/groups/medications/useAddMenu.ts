import type { MenuEntry } from "~/components/ui";
import type { PassRow } from "~/lib/medications/medicationPasses.sync";
import type { MedicationsPageTab } from "~/lib/medications/urls";

import { canAddPass } from "@caretook/data/schema";
import { Clock, Pill } from "lucide-react";
import { useMemo } from "react";
import { appUrls } from "~/lib/app-shell/appUrls";
import { passesQuery, toPasses } from "~/lib/medications/medicationPasses.sync";
import { MEDICATION_SHEET_STATE, PASS_SHEET_STATE } from "~/lib/medications/medicationSheets";
import { useLiveQuery } from "~/lib/sync";

const NO_ROWS: PassRow[] = [];

/**
 * The Medications header's `+` menu, from the tab you're on: Medication (the
 * add sheet over Schedule or the list, which it closes back to, the list's
 * search kept; from Passes, over the list) and Pass (the add-pass sheet over
 * Passes; left out once the group has its 8 passes, read live). `prefetch`
 * is the sheets' pages, so the frame loads their modules ahead.
 */
export function useAddMenu(groupId: string, tab: MedicationsPageTab | null, search: string) {
  const query = passesQuery(groupId);
  const passRows = useLiveQuery<PassRow>(query.sql, query.params, NO_ROWS);
  const roomForPass = useMemo(() => canAddPass(toPasses(passRows)), [passRows]);
  return useMemo(() => {
    const medicationTab = tab === "schedule" ? "schedule" : "list";
    const newMedication = appUrls.newMedication(groupId, medicationTab, tab === "passes" ? "" : search);
    const newPass = appUrls.newPass(groupId);
    const items: MenuEntry[] = [
      {
        id: "medication",
        label: "Medication",
        icon: Pill,
        href: newMedication,
        state: MEDICATION_SHEET_STATE,
      },
      roomForPass && {
        id: "pass",
        label: "Med time",
        icon: Clock,
        href: newPass,
        // From the Med times tab, closing goes back to it; from another tab, the sheet closes onto Med times.
        state: tab === "passes" ? PASS_SHEET_STATE : undefined,
      },
    ];
    return { items, prefetch: [newMedication, newPass] };
  }, [groupId, tab, search, roomForPass]);
}
