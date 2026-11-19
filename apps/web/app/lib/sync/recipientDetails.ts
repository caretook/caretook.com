import type { RecipientDetails, RecipientDetailsRow, SavedDetails } from "../recipientDetails";
import type { SyncDb } from "./index";
import type { LocalQuery } from "./timeline";

import { useMemo } from "react";
import { detailsMatch, toRecipientDetails } from "../recipientDetails";
import { useLiveQuery } from "./index";
import { readRows } from "./timeline";

// The recipient's writers-only details (profiles) as the device has them:
// the `care_recipient_details` row, which the `care_group_writers` stream
// brings only to owners', admins' and caretakers' devices. A viewer's device
// never has it, and a member demoted to viewer loses it on the next sync.
// Read-only here: writes are online, through `careGroup.updateRecipientDetails`.

/** The group's details row (none until someone saves them, and none on a viewer's device). */
export const recipientDetailsQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT id, group_id, phones, email, address, insurance, outside_contacts, updated_at
    FROM care_recipient_details WHERE group_id = ? ORDER BY id LIMIT 1`,
  params: [groupId],
});

/** The details rows as a loader reads them (the first render's, before the live query takes over). */
export const loadRecipientDetailsRows = (db: SyncDb, groupId: string) =>
  readRows<RecipientDetailsRow>(db, recipientDetailsQuery(groupId));

/** The details, live: another writer's save shows once it syncs; empty when there are none. */
export function useRecipientDetails(groupId: string, initial: RecipientDetailsRow[]): RecipientDetails {
  const query = useMemo(() => recipientDetailsQuery(groupId), [groupId]);
  const rows = useLiveQuery<RecipientDetailsRow>(query.sql, query.params, initial);
  const row = rows[0];
  return useMemo(() => toRecipientDetails(row), [row]);
}

const POLL_MS = 150;

/**
 * After an online save, wait (up to `ms`) for it to sync back, so the page
 * shows it when the sheet closes. True once the device has every saved
 * field; false on a timeout (it shows when it lands).
 */
export const waitForRecipientDetails = async (
  db: SyncDb,
  groupId: string,
  saved: SavedDetails,
  ms = 5_000,
): Promise<boolean> => {
  const end = Date.now() + ms;
  for (;;) {
    const [row] = await loadRecipientDetailsRows(db, groupId);
    if (row && detailsMatch(toRecipientDetails(row), saved)) return true;
    if (Date.now() >= end) return false;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
};
