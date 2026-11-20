import type { UnitChoices, VitalReading } from "@caretook/data/schema";
import type { DatedReading } from "./vitalAverages";
import type { SyncDb } from "../sync/index";
import type { LocalQuery } from "../timeline/timeline.sync";

import { isKnownReading } from "@caretook/data/schema";
import { useMemo } from "react";
import { LONGEST_WINDOW, vitalAverages, windowStart } from "./vitalAverages";
import { addDays, dayInZone, startOfDay } from "../core/zonedDay";
import { useNow } from "../live-notes/editors.sync";
import { useLiveQuery } from "../sync/index";
import { fromLocalTimestamp, readRows, toLocalTimestamp } from "../timeline/timeline.sync";

// Recent vital averages on the profile (B-100), from the device's copy: every
// vital reading in the group since the longest window began, averaged by the
// pure `vitalAverages` on a clock, so the windows move without a reload.

/** How often the windows are re-evaluated. */
export const AVERAGES_TICK_MS = 60_000;

const FALLBACK_ZONE = "UTC";

export type RecentReadingRow = { occurred_at: string; deleted_at: string | null; reading: string };

/** The group's vital readings (not deleted) taken from `from` on. */
export const recentReadingsQuery = (groupId: string, from: Date): LocalQuery => ({
  sql: `SELECT e.occurred_at, e.deleted_at, r.value AS reading
        FROM timeline_entry e, json_each(e.details, '$.readings') r
        WHERE e.group_id = ? AND e.kind = 'vital' AND e.deleted_at IS NULL AND e.occurred_at >= ?
        ORDER BY e.occurred_at, e.id`,
  params: [groupId, toLocalTimestamp(from)],
});

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/** Rows as dated readings; unknown or unreadable readings are skipped. */
export const toDatedReadings = (rows: RecentReadingRow[]): DatedReading[] =>
  rows.flatMap((row) => {
    const reading = parse(row.reading) as { type?: unknown } | null;
    if (!reading || typeof reading.type !== "string" || !isKnownReading(reading as { type: string }))
      return [];
    return [
      {
        occurredAt: fromLocalTimestamp(row.occurred_at),
        deletedAt: row.deleted_at,
        reading: reading as VitalReading,
      },
    ];
  });

const longestStart = (now: Date, timeZone: string) => windowStart(now, timeZone, LONGEST_WINDOW);

/** A loader's first read, so the profile renders complete before the live query takes over. */
export const loadRecentReadingRows = (db: SyncDb, groupId: string, timeZone: string | null) =>
  readRows<RecentReadingRow>(
    db,
    recentReadingsQuery(groupId, longestStart(new Date(), timeZone || FALLBACK_ZONE)),
  );

/**
 * The core types' averages over the last 7 and 30 days in the recipient's
 * zone, live; null when none has a reading in 30 days. `initial` is a
 * loader's `loadRecentReadingRows`.
 */
export function useVitalAverages(
  groupId: string,
  timeZone: string | null,
  units: UnitChoices,
  initial: RecentReadingRow[],
) {
  const zone = timeZone || FALLBACK_ZONE;
  const now = useNow(AVERAGES_TICK_MS);
  // Keyed on the day, so the query only changes at midnight.
  const day = dayInZone(new Date(now), zone);
  const query = useMemo(
    () => recentReadingsQuery(groupId, startOfDay(addDays(day, -(LONGEST_WINDOW - 1)), zone)),
    [groupId, day, zone],
  );
  const rows = useLiveQuery<RecentReadingRow>(query.sql, query.params, initial);
  const readings = useMemo(() => toDatedReadings(rows), [rows]);
  return useMemo(
    () => vitalAverages(readings, { now: new Date(now), timeZone: zone, units }),
    [readings, now, zone, units],
  );
}
