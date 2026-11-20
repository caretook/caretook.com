import type { LearnedEntry } from "~/lib/simpleTiles";
import type { LocalQuery } from "~/lib/sync/timeline";

import { LEARNED_DAYS } from "~/lib/simpleTiles";
import { toLocalTimestamp } from "~/lib/sync/timeline";

// Simple mode's local reads on the timeline (assistant PRD): the last 30
// days' entries the learned tiles count, and your latest entry for "Remove
// my last entry". The group's tile choice is `lib/sync/simpleMode.ts`.

/** One entry the learned tiles count: its kind, when, and a vital's reading types (JSON text). */
export type LearnedRow = { kind: string; occurred_at: string; types: string | null };

/** The kinds a tile can be, and so the only ones learning counts. */
const TILE_KINDS_SQL = "kind IN ('note', 'symptom', 'dose', 'vital')";

/** The group's live entries of a tile's kind since `LEARNED_DAYS` before `now`. */
export const learnedEntriesQuery = (groupId: string, now: Date): LocalQuery => ({
  sql: `SELECT kind, occurred_at,
               CASE WHEN kind = 'vital'
                 THEN (SELECT json_group_array(json_extract(r.value, '$.type'))
                       FROM json_each(json_extract(details, '$.readings')) r)
               END AS types
        FROM timeline_entry
        WHERE group_id = ? AND deleted_at IS NULL AND ${TILE_KINDS_SQL} AND occurred_at >= ?`,
  params: [groupId, toLocalTimestamp(new Date(now.getTime() - LEARNED_DAYS * 86_400_000))],
});

const parseTypes = (json: string | null): string[] => {
  if (!json) return [];
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
};

export const toLearnedEntry = (row: LearnedRow): LearnedEntry => ({
  kind: row.kind,
  occurredAt: row.occurred_at,
  vitalTypes: parseTypes(row.types),
});

/** Your latest entry you made yourself (not one written for you, such as a medication change). */
export type LastEntryRow = {
  id: string;
  kind: string;
  title: string | null;
  details: string | null;
  created_at: string;
};

export const lastOwnEntryQuery = (groupId: string, userId: string): LocalQuery => ({
  sql: `SELECT id, kind, title, details, created_at FROM timeline_entry
        WHERE group_id = ? AND created_by = ? AND deleted_at IS NULL AND kind != 'medicationChange'
        ORDER BY created_at DESC, id DESC LIMIT 1`,
  params: [groupId, userId],
});
