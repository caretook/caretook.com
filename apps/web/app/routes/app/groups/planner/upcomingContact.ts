import type { ContactAction } from "../../../../lib/providers/contactActions";
import type { ShownPlace } from "../../../../lib/appointments/entryPlace";
import type { LinkedProviderName } from "../../../../lib/providers/entryProviders";
import type { LocalQuery } from "../../../../lib/timeline/timeline.sync";
import type { ProviderPhone } from "@caretook/data/schema";

import { parseProviderPhones } from "@caretook/data/schema";
import { callAction, mapsHref } from "../../../../lib/providers/contactActions";
import { shownPlace } from "../../../../lib/appointments/entryPlace";

// What a Planner row says about where and with whom, and its one-tap
// actions: call the first linked provider, and map the place. Pure (the
// query is a `{ sql, params }` pair), so web:unit tests it.

/** A linked provider as the Planner needs it: the "with …" name, plus how to reach them. */
export type LinkedContact = LinkedProviderName & { phones: ProviderPhone[]; address: string | null };

export type ContactRow = {
  entry_id: string;
  provider_id: string;
  name: string | null;
  deleted_at: string | null;
  phones: string | null;
  address: string | null;
};

/**
 * The providers linked to the entries in `window` (a `… FROM timeline_entry
 * WHERE …` tail, such as `upcomingWindow`), in link order: one live query
 * for the whole list, never one per row. Deleted providers are included
 * (greyed in the "with …" line, never called).
 */
export const contactsQuery = (window: LocalQuery): LocalQuery => ({
  sql: `SELECT l.entry_id, l.provider_id, p.name, p.deleted_at, p.phones, p.address
        FROM timeline_entry_provider l JOIN provider p ON p.id = l.provider_id
        WHERE l.entry_id IN (SELECT id ${window.sql})
        ORDER BY l.entry_id, l.created_at, l.id`,
  params: window.params,
});

/** Contact rows grouped by entry, in link order. Rows without a name (half-synced) are skipped. */
export const contactsByEntry = (
  rows: readonly ContactRow[],
  toTimestamp: (value: string) => string = (v) => v,
): Map<string, LinkedContact[]> => {
  const byEntry = new Map<string, LinkedContact[]>();
  for (const row of rows) {
    if (!row.name) continue;
    const list = byEntry.get(row.entry_id) ?? [];
    list.push({
      id: row.provider_id,
      name: row.name,
      deletedAt: row.deleted_at ? toTimestamp(row.deleted_at) : null,
      phones: parseProviderPhones(row.phones),
      address: row.address,
    });
    byEntry.set(row.entry_id, list);
  }
  return byEntry;
};

/** Where an item is: the entry page's rule (`shownPlace`), over its linked contacts. */
export const placeOf = (
  entry: { place?: string | null },
  contacts: readonly LinkedContact[] = [],
): ShownPlace | null => shownPlace(entry.place, contacts);

/** A place on one line: "1200 Westside Ave, Suite 300, Springfield". */
export const placeLine = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(", ");

/**
 * A row's actions: call the first linked provider that has a number (its
 * first number), then map the place. Each only when there's something to reach.
 */
export const upcomingActions = (
  entry: { place?: string | null },
  contacts: readonly LinkedContact[] = [],
): ContactAction[] => {
  const actions: ContactAction[] = [];
  const caller = contacts.find((c) => !c.deletedAt && c.phones[0]);
  const phone = caller?.phones[0];
  const call = caller && phone ? callAction(caller.name, phone) : null;
  if (call) actions.push(call);
  const place = placeOf(entry, contacts);
  const href = place ? mapsHref(place.text) : null;
  if (place && href) {
    actions.push({ kind: "map", href, label: `Open ${placeLine(place.text)} in maps`, value: place.text });
  }
  return actions;
};
