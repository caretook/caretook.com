import type { SyncDb } from "./index";
import type { LocalQuery } from "./timeline";

import { useMemo } from "react";
import { useLiveQuery } from "./index";
import { readRows } from "./timeline";

// The care recipient's profile as every member's device has it (profiles):
// the name, birthday and time zone, the medical basics and the note for
// helpers, from the synced `care_recipient` row. Read-only here: profile
// writes are online only, through `careGroup.updateRecipient`.

export type RecipientProfileRow = {
  id: string;
  group_id: string | null;
  name: string | null;
  preferred_name: string | null;
  date_of_birth: string | null;
  time_zone: string | null;
  code_status: string | null;
  blood_type: string | null;
  primary_language: string | null;
  pronouns: string | null;
  notes: string | null;
};

export type RecipientProfile = {
  id: string;
  groupId: string;
  name: string;
  preferredName: string | null;
  /** The preferred name, else the name. */
  displayName: string;
  dateOfBirth: string | null;
  timeZone: string | null;
  codeStatus: string | null;
  bloodType: string | null;
  primaryLanguage: string | null;
  pronouns: string | null;
  notes: string | null;
};

/** The group's care recipient, with everything every member reads. */
export const recipientProfileQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT id, group_id, name, preferred_name, date_of_birth, time_zone, code_status, blood_type,
    primary_language, pronouns, notes FROM care_recipient WHERE group_id = ? ORDER BY id LIMIT 1`,
  params: [groupId],
});

export const toRecipientProfile = (row: RecipientProfileRow): RecipientProfile => {
  const name = row.name ?? "";
  const preferredName = row.preferred_name || null;
  return {
    id: row.id,
    groupId: row.group_id ?? "",
    name,
    preferredName,
    displayName: preferredName || name,
    dateOfBirth: row.date_of_birth || null,
    timeZone: row.time_zone || null,
    codeStatus: row.code_status || null,
    bloodType: row.blood_type || null,
    primaryLanguage: row.primary_language || null,
    pronouns: row.pronouns || null,
    notes: row.notes || null,
  };
};

/** The recipient's rows as a loader reads them (the first render's, before the live query takes over). */
export const loadRecipientProfileRows = (db: SyncDb, groupId: string) =>
  readRows<RecipientProfileRow>(db, recipientProfileQuery(groupId));

/** The recipient's profile, live: another member's edit shows once it syncs. Null when the group has none. */
export function useRecipientProfile(
  groupId: string,
  initial: RecipientProfileRow[],
): RecipientProfile | null {
  const query = useMemo(() => recipientProfileQuery(groupId), [groupId]);
  const rows = useLiveQuery<RecipientProfileRow>(query.sql, query.params, initial);
  const row = rows[0];
  return useMemo(() => (row ? toRecipientProfile(row) : null), [row]);
}

/** The profile's fields a save sets, as the device's copy has them (`toRecipientProfile`). */
export type RecipientProfileFields = Partial<
  Pick<
    RecipientProfile,
    | "name"
    | "preferredName"
    | "dateOfBirth"
    | "codeStatus"
    | "bloodType"
    | "primaryLanguage"
    | "pronouns"
    | "notes"
  >
>;

const POLL_MS = 150;

/**
 * After an online save, wait (up to `ms`) for the change to sync back to the
 * device, so the page shows it when the sheet closes. True once every field
 * in `fields` matches; false on a timeout (it shows when it lands).
 */
export const waitForRecipientProfile = async (
  db: SyncDb,
  groupId: string,
  fields: RecipientProfileFields,
  ms = 5_000,
): Promise<boolean> => {
  const end = Date.now() + ms;
  const matches = (profile: RecipientProfile) =>
    Object.entries(fields).every(
      ([key, value]) => profile[key as keyof RecipientProfile] === (value ?? null),
    );
  for (;;) {
    const [row] = await loadRecipientProfileRows(db, groupId);
    if (row && matches(toRecipientProfile(row))) return true;
    if (Date.now() >= end) return false;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
};
