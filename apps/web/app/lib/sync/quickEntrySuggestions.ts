import type { PredictionEntry } from "../quickEntryPredictions";
import type { LocalQuery } from "./timeline";

import { fromLocalTimestamp, toLocalTimestamp } from "./timeline";

// The entries quick entry's predictions read (`usualAtHour` in
// `lib/quickEntryPredictions.ts`): the group's live vitals, symptoms, doses
// and notes since a moment, from the device, so they work offline.

export type PredictionRow = { kind: string | null; occurred_at: string | null; details: string | null };

/** The group's live vitals, symptoms, doses and notes at or after `since` (ISO 8601). */
export const predictionEntriesQuery = (groupId: string, since: string): LocalQuery => ({
  sql: `SELECT kind, occurred_at, details FROM timeline_entry
        WHERE group_id = ? AND deleted_at IS NULL AND kind IN ('vital', 'symptom', 'dose', 'note')
          AND occurred_at >= ?`,
  params: [groupId, toLocalTimestamp(since)],
});

const parseJson = (value: string | null): unknown => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const toPredictionEntries = (rows: readonly PredictionRow[]): PredictionEntry[] =>
  rows.flatMap((row) =>
    row.kind && row.occurred_at
      ? [{ kind: row.kind, occurredAt: fromLocalTimestamp(row.occurred_at), details: parseJson(row.details) }]
      : [],
  );
