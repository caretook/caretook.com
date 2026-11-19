import type { LocalProvider, ProviderRow } from "~/lib/sync/providers";
import type { SyncDb } from "~/lib/sync";
import type { MedicationNameRow } from "~/lib/sync/medications";

import { useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { appUrls } from "~/lib/appUrls";
import { useGroup } from "~/lib/group";
import { openedFromApp } from "~/lib/medicationSheets";
import { useLiveQuery } from "~/lib/sync";
import { medicationNamesQuery } from "~/lib/sync/medications";
import { providersQuery, toProviders } from "~/lib/sync/providers";
import { readRows } from "~/lib/sync/timeline";

// Sheets over the medication list are child routes (`medications/new`,
// `medications/:medicationId/edit`): the list stays mounted underneath, with
// its search, filter and scroll position. Like the directory's sheets
// (`providerSheet.ts`).

/**
 * Close the sheet by leaving its route; Back, Escape, Cancel and a save all
 * end up in the same place: back, when it was opened by one of the app's
 * links (from the list, or from a medication's page, which it returns to);
 * otherwise (a bookmark, a reload) the list replaces it, with its search
 * kept. `toList` goes to the list whatever opened it (after a delete, the
 * page it came from is gone). Only the first call counts.
 */
export function useCloseMedicationSheet() {
  const navigate = useNavigate();
  const location = useLocation();
  const state: unknown = location.state;
  const { search } = location;
  const { id } = useGroup();
  const closed = useRef(false);
  return useCallback(
    (toList = false) => {
      if (closed.current) return;
      closed.current = true;
      if (!toList && openedFromApp(state)) void navigate(-1);
      else void navigate(appUrls.medications(id, search), { replace: true, preventScrollReset: true });
    },
    [navigate, state, search, id],
  );
}

const formProvidersQuery = (groupId: string) => providersQuery(groupId, { includeDeleted: true });

export type FormSourceRows = { providerRows: ProviderRow[]; nameRows: MedicationNameRow[] };

/** The form's sources as a sheet's loader reads them, so the first render has them. */
export const loadFormSources = async (db: SyncDb, groupId: string): Promise<FormSourceRows> => {
  const [providerRows, nameRows] = await Promise.all([
    readRows<ProviderRow>(db, formProvidersQuery(groupId)),
    readRows<MedicationNameRow>(db, medicationNamesQuery(groupId)),
  ]);
  return { providerRows, nameRows };
};

/**
 * What the form picks from, live: the group's providers (deleted ones too,
 * so a removed prescriber still has a name) and the names the group has
 * used (for suggestions).
 */
export function useMedicationFormSources(
  groupId: string,
  initial: FormSourceRows,
): { providers: LocalProvider[]; names: MedicationNameRow[] } {
  const providerQuery = formProvidersQuery(groupId);
  const providerRows = useLiveQuery<ProviderRow>(
    providerQuery.sql,
    providerQuery.params,
    initial.providerRows,
  );
  const providers = useMemo(() => toProviders(providerRows), [providerRows]);
  const nameQuery = medicationNamesQuery(groupId);
  const names = useLiveQuery<MedicationNameRow>(nameQuery.sql, nameQuery.params, initial.nameRows);
  return { providers, names };
}
