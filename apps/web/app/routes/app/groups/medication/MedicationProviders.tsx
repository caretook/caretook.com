import type { ProviderRow } from "~/lib/providers/providers.sync";

import { useMemo } from "react";
import { Link } from "react-router";
import { ContactActions, ProviderTypeIcon } from "~/components/providers";
import { Section } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { quickActions } from "~/lib/providers/contactActions";
import { useLiveQuery } from "~/lib/sync";
import { providerQuery, toProvider } from "~/lib/providers/providers.sync";

const NO_ROWS: ProviderRow[] = [];

/**
 * One of the medication's providers: its name linking to its page, what it
 * is, and its quick contact actions. A provider deleted since is greyed
 * "(removed)" and not a link. Live: edits on another device show at once.
 */
function ProviderRowItem({
  groupId,
  providerId,
  label,
  loaded,
}: {
  groupId: string;
  providerId: string;
  label: string;
  /** The loader's rows for this provider (stable), or none. */
  loaded: ProviderRow[];
}) {
  const query = providerQuery(providerId);
  const rows = useLiveQuery<ProviderRow>(query.sql, query.params, loaded);
  const provider = rows[0] ? toProvider(rows[0]) : null;
  if (!provider || provider.groupId !== groupId) return null;
  const removed = !!provider.deletedAt;
  return (
    <li
      className="hover:bg-base-200/50 relative isolate flex items-center gap-3 px-3 py-2.5"
      data-medication-provider={label.toLowerCase()}
    >
      <ProviderTypeIcon type={provider.type} past={removed || provider.status === "past"} />
      <div className="min-w-0 flex-1">
        <p className="text-base-content/70 text-sm">{label}</p>
        {removed ? (
          <p className="text-base-content/50 truncate" data-provider-name>
            {provider.name} (removed)
          </p>
        ) : (
          <Link
            to={appUrls.provider(groupId, provider.id)}
            className="block truncate font-medium outline-none before:absolute before:inset-0 focus-visible:before:outline-2 focus-visible:before:-outline-offset-2"
            data-provider-name
          >
            {provider.name}
          </Link>
        )}
      </div>
      {!removed && <ContactActions actions={quickActions(provider)} />}
    </li>
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
  return (
    <Section title="Prescriber and pharmacy" id="providers">
      {!prescriberId && !pharmacyId ? (
        <p className="text-base-content/70 text-sm">No prescriber or pharmacy yet.</p>
      ) : (
        <ul className="rounded-box border-base-300 bg-base-100 divide-base-200 divide-y overflow-hidden border">
          {prescriberId && (
            <ProviderRowItem
              groupId={groupId}
              providerId={prescriberId}
              label="Prescriber"
              loaded={prescriberRows ?? NO_ROWS}
            />
          )}
          {pharmacyId && (
            <ProviderRowItem
              groupId={groupId}
              providerId={pharmacyId}
              label="Pharmacy"
              loaded={pharmacyRows ?? NO_ROWS}
            />
          )}
        </ul>
      )}
    </Section>
  );
}
