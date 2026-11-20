import type { DoseDetails, TimelineEntryDetails, TimelineEntryKind } from "@caretook/data/schema";

import { isDoseDetails } from "@caretook/data/schema";
import { entryMedication, medicationLabel } from "./medicationEntries";

// Pass logs on the timeline: the doses logged in one round (Given all, or
// marks within one pass) share a `passLogId`, and the timeline folds them
// into one row ("Morning: 3 given, 1 refused"). Pure; web:unit tests it.

/** The round a dose was logged in, or null for anything else (or a dose logged on its own). */
export const passLogIdOf = (entry: {
  kind: TimelineEntryKind;
  details: TimelineEntryDetails | null;
}): string | null =>
  entry.kind === "dose" && isDoseDetails(entry.details) ? (entry.details.passLogId ?? null) : null;

/** The same, for a local row (its details still JSON text). */
export const rowPassLogId = (row: { kind: string | null; details: string | null }): string | null => {
  if (row.kind !== "dose" || !row.details) return null;
  try {
    const details = JSON.parse(row.details) as { passLogId?: unknown };
    return typeof details.passLogId === "string" && details.passLogId ? details.passLogId : null;
  } catch {
    return null;
  }
};

/**
 * The paging rule: a pass log is never split across pages. `rows` is the
 * window newest first, with one row beyond `limit` when there's more (as the
 * timeline's queries ask). When there's more and the first row past the page
 * belongs to a log, that log's rows on the page are held back too: the log
 * may go on past the window, and it shows whole with the next page. A log
 * that fills the whole page shows as it is (better than an empty page).
 */
export function wholeLogsPage<Row>(
  rows: readonly Row[],
  limit: number,
  logOf: (row: Row) => string | null,
): Row[] {
  const page = rows.slice(0, limit);
  if (rows.length <= limit) return page;
  const edge = logOf(rows[limit]!);
  if (!edge) return page;
  const kept = page.filter((row) => logOf(row) !== edge);
  return kept.length ? kept : page;
}

/** One thing in a day's list: an entry, or a pass log (its doses, earliest first). */
export type TimelineItem<Entry> =
  | { type: "entry"; entry: Entry }
  | {
      type: "passLog";
      /** The log's `passLogId`. */
      id: string;
      /** The pass it was logged for, when it names one. */
      passId: string | null;
      /** Its doses, earliest first, then by medication. */
      entries: Entry[];
      /** Where it sits: its earliest dose's time (ISO 8601). */
      occurredAt: string;
    };

export type Groupable = {
  id: string;
  kind: TimelineEntryKind;
  details: TimelineEntryDetails | null;
  occurredAt: string;
};

/**
 * One day's entries (newest first) with the doses of each pass log folded
 * into one item, placed at its earliest dose's time; everything else keeps
 * its place. A dose logged on its own stays an entry, and so does a log of
 * one dose at a time of its own (no pass): there's nothing to fold.
 */
export function groupPassLogs<Entry extends Groupable>(entries: readonly Entry[]): TimelineItem<Entry>[] {
  const logs = new Map<string, Entry[]>();
  for (const entry of entries) {
    const id = passLogIdOf(entry);
    if (id) logs.set(id, [...(logs.get(id) ?? []), entry]);
  }
  const folds = (doses: Entry[]) =>
    doses.length > 1 || doses.some((d) => isDoseDetails(d.details) && !!d.details.passId);

  const items: { item: TimelineItem<Entry>; at: string; order: number }[] = [];
  const placed = new Set<string>();
  entries.forEach((entry, order) => {
    const id = passLogIdOf(entry);
    const doses = id ? logs.get(id)! : null;
    if (!id || !doses || !folds(doses)) {
      items.push({ item: { type: "entry", entry }, at: entry.occurredAt, order });
      return;
    }
    if (placed.has(id)) return;
    placed.add(id);
    const sorted = [...doses].sort(
      (a, b) =>
        a.occurredAt.localeCompare(b.occurredAt) ||
        medicationLabel(entryMedication(a)).localeCompare(medicationLabel(entryMedication(b)), undefined, {
          sensitivity: "base",
        }) ||
        a.id.localeCompare(b.id),
    );
    const passId = doses.map((d) => (isDoseDetails(d.details) ? d.details.passId : null)).find(Boolean);
    const occurredAt = sorted[0]!.occurredAt;
    items.push({
      item: { type: "passLog", id, passId: passId ?? null, entries: sorted, occurredAt },
      at: occurredAt,
      order,
    });
  });
  // Newest first, as the list is; equal times keep the list's order.
  return items
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime() || a.order - b.order)
    .map((i) => i.item);
}

/** How many of a log's doses were given, skipped and refused. */
export const passLogCounts = (doses: readonly { details: TimelineEntryDetails | null }[]) => {
  const counts: Record<DoseDetails["status"], number> = { given: 0, skipped: 0, refused: 0 };
  for (const dose of doses) if (isDoseDetails(dose.details)) counts[dose.details.status] += 1;
  return counts;
};
