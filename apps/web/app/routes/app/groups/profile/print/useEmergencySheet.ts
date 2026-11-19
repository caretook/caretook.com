import type { RecipientDetailsRow } from "~/lib/recipientDetails";
import type { SyncDb } from "~/lib/sync";
import type { MedicationRow } from "~/lib/sync/medications";
import type { MemberDetailRow } from "~/lib/sync/members";
import type { RecipientProfileRow } from "~/lib/sync/profile";
import type { ProviderRow } from "~/lib/sync/providers";

import { useMemo, useState } from "react";
import { toRecipientDetails } from "~/lib/recipientDetails";
import { useLiveQuery } from "~/lib/sync";
import { medicationsQuery, toMedications } from "~/lib/sync/medications";
import { loadMemberDetailRows, memberDetailsQuery } from "~/lib/sync/members";
import { recipientProfileQuery, toRecipientProfile } from "~/lib/sync/profile";
import { providersQuery, toProviders } from "~/lib/sync/providers";
import { recipientDetailsQuery } from "~/lib/sync/recipientDetails";
import { readRows } from "~/lib/sync/timeline";
import { emergencySheet } from "./emergencyPrintSheet";

// What the emergency sheet is made from, all from the device's copy (so it
// opens and prints offline): the recipient, the writers' details row, the
// members with their emergency places and shared phones, the medications
// and the providers. The loader reads them once; live queries keep them
// current, so another member's change shows before it's printed.

export type EmergencySheetRows = {
  profileRows: RecipientProfileRow[];
  detailsRows: RecipientDetailsRow[];
  memberRows: MemberDetailRow[];
  medicationRows: MedicationRow[];
  providerRows: ProviderRow[];
};

export async function loadEmergencySheetRows(db: SyncDb, groupId: string): Promise<EmergencySheetRows> {
  const [profileRows, detailsRows, memberRows, medicationRows, providerRows] = await Promise.all([
    readRows<RecipientProfileRow>(db, recipientProfileQuery(groupId)),
    readRows<RecipientDetailsRow>(db, recipientDetailsQuery(groupId)),
    loadMemberDetailRows(db, groupId),
    readRows<MedicationRow>(db, medicationsQuery(groupId)),
    readRows<ProviderRow>(db, providersQuery(groupId)),
  ]);
  return { profileRows, detailsRows, memberRows, medicationRows, providerRows };
}

/** The sheet, live from the device. */
export function useEmergencySheet(groupId: string, initial: EmergencySheetRows) {
  // The day printed is the day the page opened.
  const [now] = useState(() => new Date());
  const q = useMemo(
    () => ({
      profile: recipientProfileQuery(groupId),
      details: recipientDetailsQuery(groupId),
      members: memberDetailsQuery(groupId),
      medications: medicationsQuery(groupId),
      providers: providersQuery(groupId),
    }),
    [groupId],
  );
  const profileRows = useLiveQuery<RecipientProfileRow>(q.profile.sql, q.profile.params, initial.profileRows);
  const detailsRows = useLiveQuery<RecipientDetailsRow>(q.details.sql, q.details.params, initial.detailsRows);
  const memberRows = useLiveQuery<MemberDetailRow>(q.members.sql, q.members.params, initial.memberRows);
  const medicationRows = useLiveQuery<MedicationRow>(
    q.medications.sql,
    q.medications.params,
    initial.medicationRows,
  );
  const providerRows = useLiveQuery<ProviderRow>(q.providers.sql, q.providers.params, initial.providerRows);

  return useMemo(() => {
    const row = profileRows[0];
    return emergencySheet({
      recipient: row ? toRecipientProfile(row) : null,
      details: toRecipientDetails(detailsRows[0]),
      members: memberRows,
      medications: toMedications(medicationRows),
      providers: toProviders(providerRows),
      // Allergies come with B-26; until then the section is left out.
      allergies: null,
      now,
    });
  }, [profileRows, detailsRows, memberRows, medicationRows, providerRows, now]);
}
