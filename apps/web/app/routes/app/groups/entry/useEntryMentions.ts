import type { LocalProvider, ProviderRow } from "~/lib/providers/providers.sync";

import { useMemo, useState } from "react";
import { getSync, useLiveQuery } from "~/lib/sync";
import { linkProvider, providersQuery, toProviders } from "~/lib/providers/providers.sync";

const NO_ROWS: ProviderRow[] = [];

/**
 * The entry page's mentions: the group's providers for the editor (live,
 * deleted ones included so their chips grey), and what a mention does here:
 * it links the provider to the entry, as the With row does (a draft is saved
 * first; a provider already linked stays one link). Deleting a mention
 * changes no link. Returns data and callbacks only.
 */
export function useEntryMentions({
  groupId,
  entryId,
  ensureStored,
}: {
  groupId: string;
  entryId: string;
  /** Saves a draft; resolves true once the entry is stored. */
  ensureStored: () => Promise<boolean>;
}): { providers: readonly LocalProvider[]; onMention: (providerId: string) => void; error: string | null } {
  const query = providersQuery(groupId, { includeDeleted: true });
  const rows = useLiveQuery<ProviderRow>(query.sql, query.params, NO_ROWS);
  const providers = useMemo(() => toProviders(rows), [rows]);
  const [error, setError] = useState<string | null>(null);

  const onMention = (providerId: string) =>
    void (async () => {
      if (!(await ensureStored()))
        return setError("Couldn't save this entry, so the provider wasn't linked.");
      const res = await linkProvider(getSync(), entryId, providerId);
      setError(res.ok ? null : res.error);
    })();

  return { providers, onMention, error };
}
