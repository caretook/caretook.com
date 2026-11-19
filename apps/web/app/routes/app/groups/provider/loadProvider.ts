import type { SyncDb } from "~/lib/sync";
import type { ProviderRow } from "~/lib/sync/providers";

import { data } from "react-router";
import { providerQuery, toProvider } from "~/lib/sync/providers";
import { readRows } from "~/lib/sync/timeline";

/**
 * The provider, their notes document and its pending updates. A provider
 * that isn't on the device, is deleted, or is in another group is a 404 with
 * no names. (The group route has already turned away a non-member.)
 */
export async function loadProvider(db: SyncDb, groupId: string, providerId: string) {
  const providerRows = await readRows<ProviderRow>(db, providerQuery(providerId));
  const provider = providerRows[0] ? toProvider(providerRows[0]) : null;
  if (!provider || provider.groupId !== groupId || provider.deletedAt) {
    throw data("Not found", { status: 404 });
  }

  const [doc] = await readRows<{ id: string; snapshot: string | null }>(db, {
    sql: "SELECT id, snapshot FROM note_document WHERE id = ? AND group_id = ?",
    params: [providerId, groupId],
  });
  const updates = doc
    ? await readRows<{ id: string; data: string | null }>(db, {
        sql: "SELECT id, data FROM note_update WHERE document_id = ?",
        params: [providerId],
      })
    : [];

  return {
    provider,
    hasDocument: !!doc,
    initial: { snapshot: doc?.snapshot ?? null, updates },
    // Starting rows for the live query (stable, so it doesn't reset each render).
    providerRows,
  };
}
