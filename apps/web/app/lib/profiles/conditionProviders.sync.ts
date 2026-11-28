import type { LocalProvider, ProviderRow } from "../providers/providers.sync";
import type { SyncDb } from "../sync/index";
import type { LocalQuery } from "../timeline/timeline.sync";
import type { ConditionRow, LocalCondition } from "./conditions.sync";

import { useMemo } from "react";
import { providerQuery, providersQuery, toProvider, toProviders } from "../providers/providers.sync";
import { useLiveQuery } from "../sync/index";
import { readRows } from "../timeline/timeline.sync";
import { sortConditions } from "@caretook/data/domain";
import { toConditions } from "./conditions.sync";

// Who diagnosed a condition and who manages it, on this device (conditions
// slice 3): read by a condition's sheets and the provider page. The writes
// are conditions.sync.ts's, with the condition and its change entry.
// Deleted providers are read too, so a condition shows them greyed
// "Removed provider"; deleted conditions never show.

// ---------------------------------------------------------------------------
// A condition's providers
// ---------------------------------------------------------------------------

/** Who manages a condition, deleted providers included, by name. */
export const conditionManagersQuery = (conditionId: string): LocalQuery => ({
  sql: `SELECT p.* FROM condition_manager cm
        JOIN provider p ON p.id = cm.provider_id AND p.group_id = cm.group_id
        WHERE cm.condition_id = ?
        ORDER BY p.name COLLATE NOCASE, p.id`,
  params: [conditionId],
});

const NO_ID = "00000000-0000-0000-0000-000000000000";

export type ConditionProviderRows = { managerRows: ProviderRow[]; diagnosedRows: ProviderRow[] };

/** A loader's read of who diagnosed a condition and who manages it. */
export async function loadConditionProviders(
  db: SyncDb,
  conditionId: string,
  diagnosedById: string | null,
): Promise<ConditionProviderRows> {
  const [managerRows, diagnosedRows] = await Promise.all([
    readRows<ProviderRow>(db, conditionManagersQuery(conditionId)),
    diagnosedById ? readRows<ProviderRow>(db, providerQuery(diagnosedById)) : Promise.resolve([]),
  ]);
  return { managerRows, diagnosedRows };
}

export type ConditionProviders = { diagnosedBy: LocalProvider | null; managers: LocalProvider[] };

/** Who diagnosed a condition and who manages it, live (a provider renamed or deleted anywhere). */
export function useConditionProviders(
  condition: Pick<LocalCondition, "id" | "diagnosedById">,
  initial: ConditionProviderRows,
): ConditionProviders {
  const m = useMemo(() => conditionManagersQuery(condition.id), [condition.id]);
  const managerRows = useLiveQuery<ProviderRow>(m.sql, m.params, initial.managerRows);
  // Always one query (hooks can't be conditional): a none id matches nothing.
  const d = useMemo(() => providerQuery(condition.diagnosedById ?? NO_ID), [condition.diagnosedById]);
  const diagnosedRows = useLiveQuery<ProviderRow>(d.sql, d.params, initial.diagnosedRows);
  return useMemo(() => {
    const row = condition.diagnosedById ? diagnosedRows.find((r) => r.id === condition.diagnosedById) : null;
    return { diagnosedBy: row ? toProvider(row) : null, managers: toProviders(managerRows) };
  }, [condition.diagnosedById, diagnosedRows, managerRows]);
}

// ---------------------------------------------------------------------------
// What the condition form picks from
// ---------------------------------------------------------------------------

/** The group's providers, deleted ones too (a chosen one deleted since shows greyed). */
const formProvidersQuery = (groupId: string) => providersQuery(groupId, { includeDeleted: true });

/** A loader's read of the providers the condition form picks from. */
export const loadFormProviders = (db: SyncDb, groupId: string) =>
  readRows<ProviderRow>(db, formProvidersQuery(groupId));

/** The providers the condition form picks from, live. */
export function useFormProviders(groupId: string, initial: ProviderRow[]): LocalProvider[] {
  const q = useMemo(() => formProvidersQuery(groupId), [groupId]);
  const rows = useLiveQuery<ProviderRow>(q.sql, q.params, initial);
  return useMemo(() => toProviders(rows), [rows]);
}

// ---------------------------------------------------------------------------
// A provider's conditions (the provider page)
// ---------------------------------------------------------------------------

type ProviderConditionRow = ConditionRow & { manages: number };

/** The live conditions a provider diagnosed or manages (`manages` says which: 1 when they manage it). */
export const providerConditionsQuery = (groupId: string, providerId: string): LocalQuery => ({
  sql: `SELECT c.*, EXISTS (
            SELECT 1 FROM condition_manager cm WHERE cm.condition_id = c.id AND cm.provider_id = ?
          ) AS manages
        FROM recipient_condition c
        WHERE c.group_id = ? AND c.deleted_at IS NULL
          AND (c.diagnosed_by_id = ? OR c.id IN (
            SELECT condition_id FROM condition_manager WHERE provider_id = ?
          ))`,
  params: [providerId, groupId, providerId, providerId],
});

export type ProviderCondition = LocalCondition & { diagnosed: boolean; manages: boolean };

const NO_ROWS: ProviderConditionRow[] = [];

/** A provider's conditions, live, active first (then by since and name). */
export function useProviderConditions(groupId: string, providerId: string): ProviderCondition[] {
  const q = useMemo(() => providerConditionsQuery(groupId, providerId), [groupId, providerId]);
  const rows = useLiveQuery<ProviderConditionRow>(q.sql, q.params, NO_ROWS);
  return useMemo(() => {
    const manages = new Set(rows.filter((r) => Number(r.manages) === 1).map((r) => r.id));
    return sortConditions(
      toConditions(rows).map((c) => ({
        ...c,
        diagnosed: c.diagnosedById === providerId,
        manages: manages.has(c.id),
      })),
    );
  }, [rows, providerId]);
}
