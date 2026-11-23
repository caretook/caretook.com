import { addDays, dayInZone, startOfDay } from "@caretook/data/schema";
import { PAGE_SIZE } from "../core/paging";

// Paging newer from a jumped-to day: where the window's upper bound moves
// next. Pure; web:unit tests it (`timelineNewer.sync.ts` reads the rows).

/** A row above the bound: when it happened (ISO 8601) and the pass log it's in, if any. */
export type NewerRow = { at: string; log: string | null };

/** The next window: its bound (null: the ordinary history) and how many rows it adds. */
export type NewerWindow = { before: string | null; added: number };

const ms = (iso: string) => new Date(iso).getTime();

/** The moment the day after `at`'s day starts in `timeZone` (DST-safe). */
const dayEnd = (at: string, timeZone: string) =>
  startOfDay(addDays(dayInZone(new Date(at), timeZone), 1), timeZone).toISOString();

/**
 * The next bound, from the rows above the current one, oldest first. It's a
 * whole day's end at least a page further, moved on while a pass log would
 * straddle it, so neither a day nor a log is split at the top edge. Fewer
 * than a page left above it: no bound, the window is the ordinary history.
 * `asked` is how many rows the read asked for (fewer back: that's all of
 * them). Null: the answer lies past these rows, so read more.
 */
export const nextNewerWindow = (
  rows: readonly NewerRow[],
  { asked, timeZone, pageSize = PAGE_SIZE }: { asked: number; timeZone: string; pageSize?: number },
): NewerWindow | null => {
  const complete = rows.length < asked;
  const everything = { before: null, added: rows.length };
  if (rows.length < pageSize) return complete ? everything : null;
  let last = pageSize - 1;
  for (;;) {
    const end = dayEnd(rows[last]!.at, timeZone);
    const endMs = ms(end);
    const cut = rows.findIndex((row) => ms(row.at) >= endMs);
    if (cut === -1) return complete ? everything : null;
    const inside = new Set(rows.slice(0, cut).flatMap((row) => (row.log ? [row.log] : [])));
    const straddling = rows.reduce(
      (found, row, i) => (i >= cut && row.log && inside.has(row.log) ? i : found),
      -1,
    );
    if (straddling !== -1) {
      last = straddling;
      continue;
    }
    if (rows.length - cut < pageSize) return complete ? everything : null;
    return { before: end, added: cut };
  }
};
