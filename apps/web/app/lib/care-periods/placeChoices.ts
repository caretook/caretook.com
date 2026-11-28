import type { SyncDb } from "~/lib/sync";
import type { LocalProvider, ProviderRow } from "~/lib/providers/providers.sync";

import { useMemo } from "react";
import { useLiveQuery } from "~/lib/sync";
import { placeChoicesQuery } from "~/lib/care-periods/carePeriods.sync";
import { toProviders } from "~/lib/providers/providers.sync";
import { readRows } from "~/lib/timeline/timeline.sync";

// The care period form's place choices, read on the device: by a loader
// first, then live. Used by the periods page and its sheets and the setup
// pages' period step.

/** The place picker's providers as a sheet's loader reads them, so the first render has them. */
export const loadPlaceRows = (db: SyncDb, groupId: string) =>
  readRows<ProviderRow>(db, placeChoicesQuery(groupId));

/** The group's providers, live (deleted ones too, so a removed place still has a name). */
export function usePlaceChoices(groupId: string, initial: ProviderRow[]): LocalProvider[] {
  const query = placeChoicesQuery(groupId);
  const rows = useLiveQuery<ProviderRow>(query.sql, query.params, initial);
  return useMemo(() => toProviders(rows), [rows]);
}
