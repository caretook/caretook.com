import type { LocalQuery } from "../timeline/timeline.sync";
import type { OtherGroupProviders } from "./fromGroups";
import type { ProviderRow } from "./providers.sync";

import { useMemo } from "react";
import { useLiveQuery } from "~/lib/sync";
import { toProvider } from "./providers.sync";

// The user's other groups' providers on this device, for the pickers'
// "From <group>" sections (`fromGroups.ts`). Live, so a provider added in
// another group shows at once.

type OtherGroupRow = ProviderRow & {
  group_name: string | null;
  recipient_name: string | null;
  recipient_preferred_name: string | null;
};

/**
 * Every provider (deleted ones too: a clinician's deleted practice isn't
 * copied) in the groups `userId` belongs to other than `groupId`, with each
 * group's name, by group then display order.
 */
export const otherGroupProvidersQuery = (userId: string, groupId: string): LocalQuery => ({
  sql: `SELECT p.*, g.name AS group_name, r.name AS recipient_name,
               r.preferred_name AS recipient_preferred_name
        FROM provider p
        JOIN care_group g ON g.id = p.group_id
        JOIN care_group_member m ON m.group_id = g.id AND m.user_id = ?
        LEFT JOIN care_recipient r ON r.group_id = g.id
        WHERE p.group_id != ?
        ORDER BY g.name, g.id, p.is_primary DESC, p.status = 'past', p.name COLLATE NOCASE, p.id`,
  params: [userId, groupId],
});

/** Nothing, while the sections are off (a viewer, a read-only editor). */
const NONE: LocalQuery = { sql: "SELECT * FROM provider WHERE 0", params: [] };
const NO_ROWS: OtherGroupRow[] = [];

/** Rows as groups, in the query's order; a group is named by its recipient, else its own name. */
export const toOtherGroups = (rows: readonly OtherGroupRow[]): OtherGroupProviders[] => {
  const groups = new Map<
    string,
    { id: string; name: string; providers: OtherGroupProviders["providers"][number][] }
  >();
  for (const row of rows) {
    const provider = toProvider(row);
    if (!provider) continue;
    let group = groups.get(provider.groupId);
    if (!group) {
      const name = row.recipient_preferred_name || row.recipient_name || row.group_name || "";
      group = { id: provider.groupId, name, providers: [] };
      groups.set(provider.groupId, group);
    }
    group.providers.push(provider);
  }
  return [...groups.values()];
};

/** The other groups' providers, live; none unless `enabled`. */
export function useOtherGroupProviders({
  userId,
  groupId,
  enabled,
}: {
  userId: string;
  groupId: string;
  enabled: boolean;
}): readonly OtherGroupProviders[] {
  const query = enabled ? otherGroupProvidersQuery(userId, groupId) : NONE;
  const rows = useLiveQuery<OtherGroupRow>(query.sql, query.params, NO_ROWS);
  return useMemo(() => toOtherGroups(rows), [rows]);
}
