import type { LocalProvider, ProviderRow } from "~/lib/providers/providers.sync";
import type { SyncDb } from "~/lib/sync";
import type { LocalPass, PassRow } from "~/lib/medications/medicationPasses.sync";
import type { MedicationNameRow } from "~/lib/medications/medications.sync";
import type { ConditionRow, LocalCondition } from "~/lib/profiles/conditions.sync";

import { useMemo } from "react";
import { useLiveQuery } from "~/lib/sync";
import { loadSchedulePasses, useSchedulePasses } from "~/lib/medications/medicationPasses.sync";
import { medicationNamesQuery } from "~/lib/medications/medications.sync";
import { conditionsQuery, toConditions } from "~/lib/profiles/conditions.sync";
import { providersQuery, toProviders } from "~/lib/providers/providers.sync";
import { readRows } from "~/lib/timeline/timeline.sync";

// What `MedicationForm` picks from, read on the device: by a loader first,
// then live. Used by the list's add and edit sheets and the setup pages'
// medications step.

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
