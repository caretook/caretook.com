import type { PrintRecipient } from "../printSheet";
import type { loadWeeklyData } from "./loadWeeklyData";
import type { MedicationRow, RecipientRow } from "~/lib/sync/medications";

import { useMemo, useState } from "react";
import { useGroup } from "~/lib/group";
import { useLiveQuery } from "~/lib/sync";
import { useSchedulePasses } from "~/lib/sync/medicationPasses";
import { medicationsQuery, recipientQuery, toMedications } from "~/lib/sync/medications";
import { weeklySheet } from "./weeklySheet";

/** The weekly sheet from `start` ("YYYY-MM-DD"; null is this week), live from the device. */
export function useWeeklySheet(
  groupId: string,
  start: string | null,
  initial: Awaited<ReturnType<typeof loadWeeklyData>>,
) {
  const group = useGroup();
  // "This week" and the day printed are the page's when it opened.
  const [now] = useState(() => new Date());

  const meds = medicationsQuery(groupId);
  const medicationRows = useLiveQuery<MedicationRow>(meds.sql, meds.params, initial.medicationRows);
  const rec = recipientQuery(groupId);
  const recipientRows = useLiveQuery<RecipientRow>(rec.sql, rec.params, initial.recipientRows);
  const passes = useSchedulePasses(groupId, initial.passRows);

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
    return weeklySheet({
      recipient,
      groupName: group.name,
      medications: toMedications(medicationRows),
      passes,
      weekStart: start,
      now,
    });
  }, [recipientRows, medicationRows, passes, group.name, start, now]);
}
