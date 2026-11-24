import type { LocalProvider, ProviderRow } from "~/lib/providers/providers.sync";
import type { SyncDb } from "~/lib/sync";
import type { LocalPass, PassRow } from "~/lib/medications/medicationPasses.sync";
import type { MedicationNameRow } from "~/lib/medications/medications.sync";
import type { ConditionRow, LocalCondition } from "~/lib/profiles/conditions.sync";

import { useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { openedFromApp, sheetTab } from "~/lib/medications/medicationSheets";
import { useLiveQuery } from "~/lib/sync";
import { loadSchedulePasses, useSchedulePasses } from "~/lib/medications/medicationPasses.sync";
import { medicationNamesQuery } from "~/lib/medications/medications.sync";
import { conditionsQuery, toConditions } from "~/lib/profiles/conditions.sync";
import { providersQuery, toProviders } from "~/lib/providers/providers.sync";
import { readRows } from "~/lib/timeline/timeline.sync";

// Sheets over the Medications tabs are child routes (`medications/<tab>/new`,
// `medications/<tab>/:medicationId/edit`): the
// tab stays mounted underneath, with its search, filter and scroll position. Like the directory's sheets
// (`providerSheet.ts`).

/**
 * Close the sheet by leaving its route; Back, Escape, Cancel and a save all
 * end up in the same place: back, when it was opened by one of the app's
 * links (from a tab, or from a medication's page, which it returns to);
 * otherwise (a bookmark, a reload) the tab underneath replaces it, with its
 * search kept. `toTab` goes to that tab whatever opened it (after a delete,
 * the page it came from is gone). Only the first call counts.
 */
export function useCloseMedicationSheet() {
  const navigate = useNavigate();
  const location = useLocation();
  const state: unknown = location.state;
  const { pathname, search } = location;
  const { id } = useGroup();
  const closed = useRef(false);
  return useCallback(
    (toTab = false) => {
      if (closed.current) return;
      closed.current = true;
      if (!toTab && openedFromApp(state)) void navigate(-1);
      else
        void navigate(appUrls.medicationTab(id, sheetTab(id, pathname), search), {
          replace: true,
          preventScrollReset: true,
        });
    },
    [navigate, state, pathname, search, id],
  );
}

const formProvidersQuery = (groupId: string) => providersQuery(groupId, { includeDeleted: true });

export type FormSourceRows = {
  providerRows: ProviderRow[];
  nameRows: MedicationNameRow[];
  passRows: PassRow[];
  /** The recipient's live conditions, for the For field. */
  conditionRows: ConditionRow[];
};

/** The form's sources as a sheet's loader reads them, so the first render has them. */
export const loadFormSources = async (db: SyncDb, groupId: string): Promise<FormSourceRows> => {
  const [providerRows, nameRows, passRows, conditionRows] = await Promise.all([
    readRows<ProviderRow>(db, formProvidersQuery(groupId)),
    readRows<MedicationNameRow>(db, medicationNamesQuery(groupId)),
    loadSchedulePasses(db, groupId),
    readRows<ConditionRow>(db, conditionsQuery(groupId)),
  ]);
  return { providerRows, nameRows, passRows, conditionRows };
};

/**
 * What the form picks from, live: the group's providers (deleted ones too,
 * so a removed prescriber still has a name), the names the group has used
 * (for suggestions), its passes (deleted ones too, so a schedule naming
 * one keeps its time) and the recipient's live conditions (the For field).
 */
export function useMedicationFormSources(
  groupId: string,
  initial: FormSourceRows,
): {
  providers: LocalProvider[];
  names: MedicationNameRow[];
  passes: LocalPass[];
  conditions: LocalCondition[];
} {
  const providerQuery = formProvidersQuery(groupId);
  const providerRows = useLiveQuery<ProviderRow>(
    providerQuery.sql,
    providerQuery.params,
    initial.providerRows,
  );
  const providers = useMemo(() => toProviders(providerRows), [providerRows]);
  const nameQuery = medicationNamesQuery(groupId);
  const names = useLiveQuery<MedicationNameRow>(nameQuery.sql, nameQuery.params, initial.nameRows);
  const passes = useSchedulePasses(groupId, initial.passRows);
  const conditionQuery = conditionsQuery(groupId);
  const conditionRows = useLiveQuery<ConditionRow>(
    conditionQuery.sql,
    conditionQuery.params,
    initial.conditionRows,
  );
  const conditions = useMemo(() => toConditions(conditionRows), [conditionRows]);
  return { providers, names, passes, conditions };
}
