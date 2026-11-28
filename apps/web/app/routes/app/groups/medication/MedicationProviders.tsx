import type { GroupTagRow } from "~/lib/tags/tags.sync";
import type { ProviderRow } from "~/lib/providers/providers.sync";

import { useMemo } from "react";
import { ContactActions, ProviderCard } from "~/components/providers";
import { useGroupRecordTags } from "~/components/tags";
import { EmptyState, List, Section } from "~/components/ui";
import { quickActions } from "~/lib/providers/contactActions";
import { useLiveQuery } from "~/lib/sync";
import { providerQuery, toProvider } from "~/lib/providers/providers.sync";

const NO_ROWS: ProviderRow[] = [];
const NO_TAGS: GroupTagRow[] = [];

/**
 * One of the medication's providers: the shared `ProviderCard` (condensed)
 * under its label, its name linking to its page, its badges and tags, and
 * all its quick contact actions. A provider deleted since is greyed
 * "Removed provider", with no link or actions. Live: edits on another device show
 * at once.
 */
function ProviderRowItem({
  groupId,
  providerId,
  label,
  loaded,
  tags,
}: {
  groupId: string;
  providerId: string;
  label: string;
  /** The loader's rows for this provider (stable), or none. */
  loaded: ProviderRow[];
  tags: readonly GroupTagRow[];
}) {
  const query = providerQuery(providerId);
  const rows = useLiveQuery<ProviderRow>(query.sql, query.params, loaded);
  const provider = rows[0] ? toProvider(rows[0]) : null;
  if (!provider || provider.groupId !== groupId) return null;
  return (
    <ProviderCard
      provider={provider}
      look="condensed"
      label={label}
      removed={!!provider.deletedAt}
      actions={<ContactActions actions={quickActions(provider)} />}
      tags={tags}
      data-medication-provider={label.toLowerCase()}
    />
  );
}

/** The prescriber and the pharmacy, when they're set. */
export function MedicationProviders({
  groupId,
  prescriberId,
  pharmacyId,
  initialRows,
}: {
  groupId: string;
  prescriberId: string | null;
  pharmacyId: string | null;
  /** The loader's provider rows (a stable array), for the first render. */
  initialRows: ProviderRow[];
}) {
  // Stable per provider: the loader's row when it has this provider, else a constant.
  const [prescriberRows, pharmacyRows] = useMemo(
    () =>
      [prescriberId, pharmacyId].map((id) => {
        const row = initialRows.find((r) => r.id === id);
        return row ? [row] : NO_ROWS;
      }),
    [initialRows, prescriberId, pharmacyId],
  );
  // One live query for both rows' tags, never one per row.
  const tagsOf = useGroupRecordTags(groupId, "provider");
  return (
    <Section title="Prescriber and pharmacy" id="providers">
      {!prescriberId && !pharmacyId ? (
        <EmptyState>No prescriber or pharmacy yet.</EmptyState>
      ) : (
        <List>
          {prescriberId && (
            <ProviderRowItem
              groupId={groupId}
              providerId={prescriberId}
              label="Prescriber"
              loaded={prescriberRows ?? NO_ROWS}
              tags={tagsOf.get(prescriberId) ?? NO_TAGS}
            />
          )}
          {pharmacyId && (
            <ProviderRowItem
              groupId={groupId}
              providerId={pharmacyId}
              label="Pharmacy"
              loaded={pharmacyRows ?? NO_ROWS}
              tags={tagsOf.get(pharmacyId) ?? NO_TAGS}
            />
          )}
        </List>
      )}
    </Section>
  );
}
