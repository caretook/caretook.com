// An entry's linked providers as text, the same on the entry page's With row
// and the timeline's "with …" line. Pure; unit-tested in web:unit.

/** A linked provider as an entry shows it. */
export type LinkedProviderName = { id: string; name: string; deletedAt: string | null };

/** A linked provider's label: the name, with "(removed)" once they're deleted. */
export const chipLabel = (provider: { name: string; deletedAt: string | null }) =>
  provider.deletedAt ? `${provider.name} (removed)` : provider.name;

/** How many names the timeline's "with …" line shows before "+N". */
export const WITH_NAMES_SHOWN = 2;

/**
 * The timeline's "with …" line: the first `shown` providers, in link order,
 * and how many more there are ("+N").
 */
export const withSummary = <P extends LinkedProviderName>(
  providers: readonly P[],
  shown = WITH_NAMES_SHOWN,
): { names: P[]; more: number } => ({
  names: providers.slice(0, shown),
  more: Math.max(0, providers.length - shown),
});

/** The whole line as one string, for screen readers and titles: "with Dr. A, Dr. B and 1 more". */
export const withText = (providers: readonly LinkedProviderName[], shown = WITH_NAMES_SHOWN) => {
  const { names, more } = withSummary(providers, shown);
  if (names.length === 0) return "";
  const list = names.map(chipLabel).join(", ");
  return more ? `with ${list} and ${more} more` : `with ${list}`;
};

export type EntryProviderLinkRow = {
  entry_id: string;
  provider_id: string;
  name: string | null;
  deleted_at: string | null;
};

/**
 * Link rows (already in link order) grouped by entry. Rows without a name (a
 * half-synced provider) are skipped. `toTimestamp` normalises `deleted_at`.
 */
export const groupLinksByEntry = (
  rows: readonly EntryProviderLinkRow[],
  toTimestamp: (value: string) => string = (v) => v,
): Map<string, LinkedProviderName[]> => {
  const byEntry = new Map<string, LinkedProviderName[]>();
  for (const row of rows) {
    if (!row.name) continue;
    const list = byEntry.get(row.entry_id) ?? [];
    list.push({
      id: row.provider_id,
      name: row.name,
      deletedAt: row.deleted_at ? toTimestamp(row.deleted_at) : null,
    });
    byEntry.set(row.entry_id, list);
  }
  return byEntry;
};
