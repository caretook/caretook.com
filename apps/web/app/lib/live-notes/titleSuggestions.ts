import { DEFAULT_EVENT_TITLE } from "./liveEntry";

// Title suggestions for an unnamed event: the group's own recent event
// titles, as one-tap chips. Pure (no database or React), so web:unit tests
// it; lib/live-notes/titleSuggestions.sync.ts reads the rows.

/** At most this many chips. */
export const TITLE_SUGGESTION_LIMIT = 5;

/** A use counts half as much after this long, so this month's titles outrank last season's. */
export const TITLE_SUGGESTION_HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;

/** One past event, as read from the local database. */
export type TitleUse = { title: string | null; occurredAt: string; deletedAt?: string | null };

/**
 * The group's event titles, best first: each use counts, weighted by how
 * recent it is (a 14-day half-life), so a weekly "Physical therapy" beats a
 * one-off from last month. Titles match case-insensitively and show as most
 * recently written. Deleted entries, blank titles and the default "Event"
 * are left out. Ties go to the more recent title.
 */
export function suggestTitles(
  rows: readonly TitleUse[],
  limit = TITLE_SUGGESTION_LIMIT,
  now = Date.now(),
): string[] {
  const byKey = new Map<string, { title: string; score: number; last: number }>();
  for (const row of rows) {
    if (row.deletedAt) continue;
    const title = row.title?.trim().replace(/\s+/g, " ") ?? "";
    const key = title.toLocaleLowerCase();
    if (!key || key === DEFAULT_EVENT_TITLE.toLocaleLowerCase()) continue;
    const at = Date.parse(row.occurredAt);
    if (Number.isNaN(at)) continue;
    // A planned (future) event counts as now.
    const weight = 0.5 ** (Math.max(0, now - at) / TITLE_SUGGESTION_HALF_LIFE_MS);
    const seen = byKey.get(key);
    if (!seen) byKey.set(key, { title, score: weight, last: at });
    else {
      seen.score += weight;
      if (at > seen.last) Object.assign(seen, { title, last: at });
    }
  }
  return [...byKey.values()]
    .sort((a, b) => b.score - a.score || b.last - a.last || a.title.localeCompare(b.title))
    .slice(0, Math.max(0, limit))
    .map((s) => s.title);
}
