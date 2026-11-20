import type { TimelineItem as DayItem } from "./timelineDays";
import type { Groupable, TimelineItem as PassItem } from "../../../../lib/medications/passLogs";

import { groupPassLogs } from "../../../../lib/medications/passLogs";

/** One row of a day's list: an entry, a pass log, or a care period's marker. */
export type DayListItem<E, M> = PassItem<E> | Extract<DayItem<E, M>, { type: "marker" }>;

/**
 * A day's items (entries and care period markers, newest first, from
 * `withMarkers`) with each pass log's doses folded into one item
 * (`groupPassLogs`). Markers keep their moments: a marker sits above
 * anything strictly older, so an entry or log at its exact moment stays
 * above it, as `withMarkers` places them.
 */
export function foldPassLogs<E extends Groupable, M>(items: readonly DayItem<E, M>[]): DayListItem<E, M>[] {
  const entries: E[] = [];
  const markers: Extract<DayItem<E, M>, { type: "marker" }>[] = [];
  for (const it of items) {
    if (it.type === "entry") entries.push(it.entry);
    else markers.push(it);
  }
  const grouped = groupPassLogs(entries);
  if (markers.length === 0) return grouped;
  const atOf = (it: PassItem<E>) =>
    new Date(it.type === "entry" ? it.entry.occurredAt : it.occurredAt).getTime();
  const out: DayListItem<E, M>[] = [];
  let m = 0;
  for (const it of grouped) {
    const at = atOf(it);
    while (m < markers.length && new Date(markers[m]!.occurredAt).getTime() > at) out.push(markers[m++]!);
    out.push(it);
  }
  while (m < markers.length) out.push(markers[m++]!);
  return out;
}
