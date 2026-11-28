import type { ConditionProviders as Providers } from "~/lib/profiles/conditionProviders.sync";
import type { LocalProvider } from "~/lib/providers/providers.sync";

import { Link } from "react-router";
import { LINK } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { REMOVED_PROVIDER } from "~/lib/providers/entryProviders";

/** A provider's name: a link to their page, or greyed "Removed provider" text once deleted. */
function ProviderName({ groupId, provider }: { groupId: string; provider: LocalProvider }) {
  if (provider.deletedAt)
    return (
      <span className="text-faint" data-condition-provider={provider.id} data-removed="">
        {REMOVED_PROVIDER}
      </span>
    );
  return (
    <Link
      to={appUrls.provider(groupId, provider.id)}
      className={`${LINK} font-medium`}
      data-condition-provider={provider.id}
    >
      {provider.name}
    </Link>
  );
}

/**
 * Who diagnosed a condition and who manages it (conditions slice 3), each
 * opening the provider's page; a deleted provider stays, greyed
 * "Removed provider" and not a link. Each line is left out when nobody is named.
 */
export function ConditionProviders({ groupId, providers }: { groupId: string; providers: Providers }) {
  const { diagnosedBy, managers } = providers;
  if (!diagnosedBy && !managers.length) return null;
  return (
    <dl className="grid grid-cols-2 gap-3" data-condition-providers="">
      {diagnosedBy && (
        <div data-condition-line="diagnosedBy">
          <dt className="text-muted text-sm">Diagnosed by</dt>
          <dd>
            <ProviderName groupId={groupId} provider={diagnosedBy} />
          </dd>
        </div>
      )}
      {managers.length > 0 && (
        <div data-condition-line="managedBy">
          <dt className="text-muted text-sm">Managed by</dt>
          <dd>
            <ul className="space-y-0.5">
              {managers.map((m) => (
                <li key={m.id}>
                  <ProviderName groupId={groupId} provider={m} />
                </li>
              ))}
            </ul>
          </dd>
        </div>
      )}
    </dl>
  );
}
