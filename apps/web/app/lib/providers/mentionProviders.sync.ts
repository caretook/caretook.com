import type { LocalProvider, ProviderRow } from "./providers.sync";

import { useMemo } from "react";
import { useLiveQuery } from "~/lib/sync";
import { providersQuery, toProviders } from "./providers.sync";

const NO_ROWS: ProviderRow[] = [];

/**
 * The group's providers for a live document's mentions (`LiveNotesEditor`'s
 * `providers`): live, deleted ones included so their chips grey, and a
 * rename shows at once.
 */
export function useMentionProviders(groupId: string): readonly LocalProvider[] {
  const query = providersQuery(groupId, { includeDeleted: true });
  const rows = useLiveQuery<ProviderRow>(query.sql, query.params, NO_ROWS);
  return useMemo(() => toProviders(rows), [rows]);
}
