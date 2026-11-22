import type { SearchPageData, ProviderResultRow } from "./loadSearch";
import type { EasyOpened } from "./EasyResultSheet";
import type { MedicationRow } from "~/lib/medications/medications.sync";
import type { ConditionRow } from "~/lib/profiles/conditions.sync";

import { useMemo } from "react";
import { toMedication } from "~/lib/medications/medications.sync";
import { toCondition } from "~/lib/profiles/conditions.sync";
import { useLiveQuery } from "~/lib/sync";
import { providerResultsSql, toProviderResult } from "./loadSearch";

/** Which result an easy role opened: only its type and id, so the sheet reads the row as it is now. */
export type EasyOpenedRef = { type: EasyOpened["type"]; id: string };

// One row by id, deleted or not (a deleted row reads as gone).
const QUERIES: Record<EasyOpenedRef["type"], string> = {
  provider: providerResultsSql("p.id = ?"),
  medication: "SELECT * FROM medication WHERE group_id = ? AND id = ?",
  condition: "SELECT * FROM recipient_condition WHERE group_id = ? AND id = ?",
};

type Row = ProviderResultRow | MedicationRow | ConditionRow;

const NONE: Row[] = [];

const toOpened = (type: EasyOpenedRef["type"], row: Row): EasyOpened | null => {
  if (type === "provider") {
    const provider = toProviderResult(row as ProviderResultRow);
    return provider && { type, provider };
  }
  if (type === "medication") {
    const medication = row.deleted_at ? null : toMedication(row as MedicationRow);
    return medication && { type, medication };
  }
  const condition = toCondition(row as ConditionRow);
  return condition && { type, condition };
};

/** The row as the search results last read it, before the live query first answers. */
const fromResults = ({ type, id }: EasyOpenedRef, data: SearchPageData): EasyOpened | null => {
  if (type === "provider") return data.providers[id] ? { type, provider: data.providers[id] } : null;
  if (type === "medication") return data.medications[id] ? { type, medication: data.medications[id] } : null;
  return data.conditions[id] ? { type, condition: data.conditions[id] } : null;
};

/**
 * The opened provider, medication or condition, live (B-469): another
 * member's edit shows in the open sheet, and null once it's deleted or gone
 * from the device. Until the live query first answers it's the results' copy;
 * an edit that stops it matching the search keeps it here all the same.
 */
export function useEasyOpened(groupId: string, ref: EasyOpenedRef, data: SearchPageData): EasyOpened | null {
  const rows = useLiveQuery<Row>(QUERIES[ref.type], [groupId, ref.id], NONE);
  const row = rows[0];
  const live = useMemo(() => (row ? toOpened(ref.type, row) : undefined), [ref.type, row]);
  // No row yet: the watch hasn't answered, or the row left the device (and so the results too).
  return live === undefined ? fromResults(ref, data) : live;
}
