import type { RecipientDetailsRow } from "~/lib/profiles/recipientDetails";
import type { AllergyRows } from "~/lib/medications/allergies.sync";
import type { PassRow } from "~/lib/medications/medicationPasses.sync";
import type { SyncDb } from "~/lib/sync";
import type { MedicationRow } from "~/lib/medications/medications.sync";
import type { MemberDetailRow } from "~/lib/care-groups/members.sync";
import type { RecipientProfileRow } from "~/lib/profiles/profile.sync";
import type { ProviderRow } from "~/lib/providers/providers.sync";

import { useMemo, useState } from "react";
import { toRecipientDetails } from "~/lib/profiles/recipientDetails";
import { useLiveQuery } from "~/lib/sync";
import { loadAllergies, useAllergies } from "~/lib/medications/allergies.sync";
import { loadSchedulePasses, useSchedulePasses } from "~/lib/medications/medicationPasses.sync";
import { medicationsQuery, toMedications } from "~/lib/medications/medications.sync";
import { loadMemberDetailRows, memberDetailsQuery } from "~/lib/care-groups/members.sync";
import { recipientProfileQuery, toRecipientProfile } from "~/lib/profiles/profile.sync";
import { providersQuery, toProviders } from "~/lib/providers/providers.sync";
import { recipientDetailsQuery } from "~/lib/profiles/recipientDetails.sync";
import { readRows } from "~/lib/timeline/timeline.sync";
import { emergencySheet } from "./emergencyPrintSheet";

// What the emergency sheet is made from, all from the device's copy (so it
// opens and prints offline): the recipient, the writers' details row, the
// members with their emergency places and shared phones, the medications
// (with the passes their schedules name), the allergies and the providers. The loader reads them once; live queries keep them
// current, so another member's change shows before it's printed.

export type EmergencySheetRows = {
  profileRows: RecipientProfileRow[];
  detailsRows: RecipientDetailsRow[];
  memberRows: MemberDetailRow[];
  medicationRows: MedicationRow[];
  providerRows: ProviderRow[];
  passRows: PassRow[];
  allergyRows: AllergyRows;
};

export async function loadEmergencySheetRows(db: SyncDb, groupId: string): Promise<EmergencySheetRows> {
  const [profileRows, detailsRows, memberRows, medicationRows, providerRows, passRows, allergyRows] =
    await Promise.all([
      readRows<RecipientProfileRow>(db, recipientProfileQuery(groupId)),
      readRows<RecipientDetailsRow>(db, recipientDetailsQuery(groupId)),
      loadMemberDetailRows(db, groupId),
      readRows<MedicationRow>(db, medicationsQuery(groupId)),
      readRows<ProviderRow>(db, providersQuery(groupId)),
      loadSchedulePasses(db, groupId),
      loadAllergies(db, groupId),
    ]);
  return { profileRows, detailsRows, memberRows, medicationRows, providerRows, passRows, allergyRows };
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
  const passes = useSchedulePasses(groupId, initial.passRows);
  const { state: allergies } = useAllergies(groupId, initial.allergyRows);

  return useMemo(() => {
    const row = profileRows[0];
    return emergencySheet({
      recipient: row ? toRecipientProfile(row) : null,
      details: toRecipientDetails(detailsRows[0]),
      members: memberRows,
      medications: toMedications(medicationRows),
      providers: toProviders(providerRows),
      // No recipient, no allergies to list (or to say are unrecorded).
      allergies: row ? allergies : null,
      passes,
      now,
    });
  }, [profileRows, detailsRows, memberRows, medicationRows, providerRows, passes, allergies, now]);
}
