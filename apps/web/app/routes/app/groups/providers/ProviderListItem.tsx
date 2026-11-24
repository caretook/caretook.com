import type { LocalProvider } from "~/lib/providers/providers.sync";

import { Link } from "react-router";
import { ProviderTypeIcon } from "~/components/providers";
import { Badge, ListRow, STATUS_TONE } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { PROVIDER_TYPE_META } from "~/lib/providers/providerDirectory";

/**
 * A provider in the directory: what they are and the badges. The name is a
 * link stretched over the row, so the whole row is one target that opens their
 * page, where the contact links sit beside the notes (B-422).
 */
export function ProviderListItem({
  provider,
  practiceName,
}: {
  provider: LocalProvider;
  practiceName: string | null;
}) {
  const past = provider.status === "past";
  const details = [PROVIDER_TYPE_META[provider.type].label, provider.specialty, practiceName].filter(Boolean);
  return (
    <ListRow
      className="hover:bg-base-200/50 relative isolate flex items-start gap-3"
      data-provider-id={provider.id}
    >
      <ProviderTypeIcon type={provider.type} past={past} />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5">
          <Link
            to={appUrls.provider(provider.groupId, provider.id)}
            className={`truncate font-medium outline-none before:absolute before:inset-0 focus-visible:before:outline-2 focus-visible:before:-outline-offset-2 ${past ? "text-muted" : ""}`}
            data-provider-name
          >
            {provider.name}
          </Link>
          {provider.isPrimary && !past && (
            <Badge tone={STATUS_TONE.current} className="shrink-0">
              Primary
            </Badge>
          )}
          {past && (
            <Badge tone={STATUS_TONE.past} className="shrink-0">
              Past
            </Badge>
          )}
        </p>
        <p className="text-muted truncate text-sm">{details.join(" · ")}</p>
      </div>
    </ListRow>
  );
}
