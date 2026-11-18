import type { TitleUse } from "../titleSuggestions";

import { useMemo } from "react";
import { suggestTitles } from "../titleSuggestions";
import { useLiveQuery } from "./index";

// The group's recent event titles, read from the local database (so they
// work offline) and ranked by the pure `suggestTitles`.

/** Enough recent events to rank from; older ones would weigh almost nothing. */
const RECENT_EVENTS = 200;

const eventTitlesSql = `SELECT title, occurred_at AS occurredAt, deleted_at AS deletedAt
  FROM timeline_entry
  WHERE group_id = ? AND kind = 'event' AND deleted_at IS NULL AND title IS NOT NULL
  ORDER BY occurred_at DESC
  LIMIT ${RECENT_EVENTS}`;

const NO_ROWS: TitleUse[] = [];

/** Up to 5 titles for an unnamed event's chips, live. */
export function useEventTitleSuggestions(groupId: string): string[] {
  const rows = useLiveQuery<TitleUse>(eventTitlesSql, [groupId], NO_ROWS);
  return useMemo(() => suggestTitles(rows), [rows]);
}
