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
