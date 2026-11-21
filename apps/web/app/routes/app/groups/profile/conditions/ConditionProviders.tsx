import type { ConditionProviders as Providers } from "~/lib/profiles/conditionProviders.sync";
import type { LocalProvider } from "~/lib/providers/providers.sync";

import { Link } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { chosenLabel } from "~/lib/providers/providerPicker";

/** A provider's name: a link to their page, or greyed "(removed)" text once deleted. */
function ProviderName({ groupId, provider }: { groupId: string; provider: LocalProvider }) {
  if (provider.deletedAt)
    return (
      <span className="text-base-content/50" data-condition-provider={provider.id} data-removed="">
        {chosenLabel(provider.name, { deleted: true })}
      </span>
    );
  return (
    <Link
      to={appUrls.provider(groupId, provider.id)}
      className="link font-medium"
      data-condition-provider={provider.id}
    >
      {provider.name}
    </Link>
  );
}

/**
 * Who diagnosed a condition and who manages it (conditions slice 3), each
 * opening the provider's page; a deleted provider stays, greyed
 * "(removed)" and not a link. Each line is left out when nobody is named.
 */
export function ConditionProviders({ groupId, providers }: { groupId: string; providers: Providers }) {
  const { diagnosedBy, managers } = providers;
  if (!diagnosedBy && !managers.length) return null;
  return (
    <dl className="grid grid-cols-2 gap-3" data-condition-providers="">
      {diagnosedBy && (
        <div data-condition-line="diagnosedBy">
          <dt className="text-base-content/70 text-sm">Diagnosed by</dt>
          <dd>
            <ProviderName groupId={groupId} provider={diagnosedBy} />
          </dd>
        </div>
      )}
      {managers.length > 0 && (
        <div data-condition-line="managedBy">
          <dt className="text-base-content/70 text-sm">Managed by</dt>
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
