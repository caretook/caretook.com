import type { SyncDb } from "../sync/index";
import type { LocalQuery } from "../timeline/timeline.sync";

import { useLiveQuery } from "../sync/index";
import { readRows } from "../timeline/timeline.sync";

// The owners' "Details outside Caretook" switch on the device
// (appointments-2): `care_group.details_outside_allowed`, synced, so the
// Calendar & reminders page and group settings → Details show it offline and
// follow another owner's change. Only owners change it, online, through
// `calendars.group.setDetailsAllowed`.

export type DetailsAllowedRow = { details_outside_allowed: number | null };

export const detailsAllowedQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT details_outside_allowed FROM care_group WHERE id = ? LIMIT 1`,
  params: [groupId],
});

/** The switch's rows now (a loader's start for `useDetailsAllowed`). */
export const loadDetailsAllowed = (db: SyncDb, groupId: string) =>
  readRows<DetailsAllowedRow>(db, detailsAllowedQuery(groupId));

/** Whether the group's owners allow details, live; null until the group's row has it. */
export function useDetailsAllowed(groupId: string, initial: DetailsAllowedRow[]): boolean | null {
  const q = detailsAllowedQuery(groupId);
  const rows = useLiveQuery<DetailsAllowedRow>(q.sql, q.params, initial);
  const value = rows[0]?.details_outside_allowed;
  return value === null || value === undefined ? null : !!value;
}
