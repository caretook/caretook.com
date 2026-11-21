import type { GuideGroup } from "../connectors/connectGuide";
import type { SyncDb } from "../sync/index";
import type { LocalQuery } from "../timeline/timeline.sync";

import { useLiveQuery } from "../sync/index";
import { readRows } from "../timeline/timeline.sync";

// The owners' Assistants switch on the device (connectors PRD):
// `care_group.connectors_enabled`, synced, so group settings → Assistants
// shows it offline and follows another owner's change. Only owners change
// it, online, through `careGroup.update`.

export type AssistantsSwitchRow = { connectors_enabled: number | null };

export const assistantsSwitchQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT connectors_enabled FROM care_group WHERE id = ? LIMIT 1`,
  params: [groupId],
});

/** The switch's rows now (a loader's start for `useAssistantsEnabled`). */
export const loadAssistantsSwitch = (db: SyncDb, groupId: string) =>
  readRows<AssistantsSwitchRow>(db, assistantsSwitchQuery(groupId));

/** Whether the group allows assistants, live; off until it has synced. */
export function useAssistantsEnabled(groupId: string, initial: AssistantsSwitchRow[]) {
  const q = assistantsSwitchQuery(groupId);
  const rows = useLiveQuery<AssistantsSwitchRow>(q.sql, q.params, initial);
  return !!rows[0]?.connectors_enabled;
}

export type MyAssistantsGroupRow = { role: string | null; connectors_enabled: number | null };

/** Every group `userId` is in on the device: their role and the group's switch (Settings → Devices' guide). */
export const myAssistantsGroupsQuery = (userId: string): LocalQuery => ({
  sql: `SELECT m.role, g.connectors_enabled
        FROM care_group g
        JOIN care_group_member m ON m.group_id = g.id AND m.user_id = ?`,
  params: [userId],
});

/** Those groups now (a loader's start for `useMyAssistantsGroups`). */
export const loadMyAssistantsGroups = (db: SyncDb, userId: string) =>
  readRows<MyAssistantsGroupRow>(db, myAssistantsGroupsQuery(userId));

/** Those groups, live, as the guide takes them. */
export function useMyAssistantsGroups(userId: string, initial: MyAssistantsGroupRow[]): GuideGroup[] {
  const q = myAssistantsGroupsQuery(userId);
  const rows = useLiveQuery<MyAssistantsGroupRow>(q.sql, q.params, initial);
  return rows.map((r) => ({ role: r.role, enabled: !!r.connectors_enabled }));
}
