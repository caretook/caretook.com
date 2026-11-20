import type { LocalProvider } from "~/lib/providers/providers.sync";

import { Link } from "react-router";
import { ContactDetails, ProviderTypeIcon } from "~/components/providers";
import { appUrls } from "~/lib/app-shell/appUrls";
import { contactDetails } from "~/lib/providers/contactActions";
import { PROVIDER_TYPE_META } from "~/lib/providers/providerDirectory";

/**
 * A provider in the directory: what they are, the badges, and their numbers,
 * address and email as links (B-44). The name is a link stretched over the
 * row, so a tap anywhere else opens their page; the contact links sit above it.
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
    <li
      className="hover:bg-base-200/50 relative isolate flex items-start gap-3 px-3 py-2.5"
      data-provider-id={provider.id}
    >
      <ProviderTypeIcon type={provider.type} past={past} />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5">
          <Link
            to={appUrls.provider(provider.groupId, provider.id)}
            className={`truncate font-medium outline-none before:absolute before:inset-0 focus-visible:before:outline-2 focus-visible:before:-outline-offset-2 ${past ? "text-base-content/70" : ""}`}
            data-provider-name
          >
            {provider.name}
          </Link>
          {provider.isPrimary && !past && (
            <span className="badge badge-primary badge-sm shrink-0">Primary</span>
          )}
          {past && <span className="badge badge-ghost badge-sm shrink-0">Past</span>}
        </p>
        <p className="text-base-content/70 truncate text-sm">{details.join(" · ")}</p>
        <ContactDetails details={contactDetails(provider)} muted={past} />
      </div>
    </li>
  );
}
