import type { EntryMedication } from "./medicationEntries";
import type { EntryFilters, LocalQuery } from "../timeline/timeline.sync";

import { useMemo } from "react";
import { useLiveQuery } from "../sync/index";
import { entryWindow, fromLocalTimestamp, historyWindow } from "../timeline/timeline.sync";

// Medications as the timeline needs them: the names behind its doses and
// changes, and the Dose sheet's choices. Local reads for `useLiveQuery` and
// loaders; the writes are `medications.ts`'s (`logDose`, `updateDose`).

export type EntryMedicationRow = {
  id: string;
  name: string | null;
  strength: string | null;
  deleted_at: string | null;
};

/**
 * The medications the timeline's doses and changes name, deleted ones too (a
 * dose keeps its medication's name): one query over the same window as the
 * entries, never one per row. With a `cutoff` that's the timeline's history
 * (`historyWindow`, which ends at now); without one, `entryWindow`.
 */
export const timelineMedicationsQuery = (
  groupId: string,
  filters: EntryFilters,
  limit: number,
  cutoff?: string,
): LocalQuery => {
  const window = cutoff
    ? historyWindow(groupId, filters, limit, cutoff)
    : entryWindow(groupId, filters, limit);
  return {
    sql: `SELECT m.id, m.name, m.strength, m.deleted_at FROM medication m
          WHERE m.group_id = ?
            AND m.id IN (SELECT json_extract(details, '$.medicationId') ${window.sql})`,
    params: [groupId, ...window.params],
  };
};

export const toEntryMedication = (row: EntryMedicationRow): EntryMedication => ({
  id: row.id,
  name: row.name ?? "",
  strength: row.strength,
  deletedAt: row.deleted_at ? fromLocalTimestamp(row.deleted_at) : null,
});

const NO_ROWS: EntryMedicationRow[] = [];

/** The timeline's medications, live, by id (`timelineMedicationsQuery`). */
export function useTimelineMedications(
  groupId: string,
  filters: EntryFilters,
  limit: number,
  cutoff?: string,
) {
  const query = timelineMedicationsQuery(groupId, filters, limit, cutoff);
  const rows = useLiveQuery<EntryMedicationRow>(query.sql, query.params, NO_ROWS);
  return useMemo(() => {
    const byId = new Map(rows.map((row) => [row.id, toEntryMedication(row)]));
    return (medicationId: string) => byId.get(medicationId);
  }, [rows]);
}

export type DoseChoiceRow = {
  id: string;
  name: string | null;
  strength: string | null;
  dose: string | null;
  last_given: string | null;
};

/** A current medication the Dose sheet offers, with the dose it defaults to. */
export type DoseChoice = { id: string; name: string; strength: string | null; dose: string | null };

/**
 * The group's current medications (not deleted) for the Dose sheet: the
 * most recently given first, then the ones never given, each by name.
 */
export const doseChoicesQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT m.id, m.name, m.strength, m.dose,
               (SELECT MAX(e.occurred_at) FROM timeline_entry e
                 WHERE e.group_id = m.group_id AND e.kind = 'dose' AND e.deleted_at IS NULL
                   AND json_extract(e.details, '$.status') = 'given'
                   AND json_extract(e.details, '$.medicationId') = m.id) AS last_given
        FROM medication m
        WHERE m.group_id = ? AND m.deleted_at IS NULL AND m.status = 'current' AND m.name IS NOT NULL
        ORDER BY last_given IS NULL, last_given DESC, m.name COLLATE NOCASE, m.id`,
  params: [groupId],
});

export const toDoseChoices = (rows: DoseChoiceRow[]): DoseChoice[] =>
  rows.map((row) => ({ id: row.id, name: row.name ?? "", strength: row.strength, dose: row.dose }));
