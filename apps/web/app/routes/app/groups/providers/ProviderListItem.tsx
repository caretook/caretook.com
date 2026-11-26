import type { LocalProvider } from "~/lib/providers/providers.sync";

import { Link } from "react-router";
import { ContactActions, ProviderTypeIcon } from "~/components/providers";
import { TagChips } from "~/components/tags";
import { Badge, ListRow, STATUS_TONE } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { quickActions } from "~/lib/providers/contactActions";
import { PROVIDER_TYPE_META } from "~/lib/providers/providerDirectory";

/**
 * A provider in the directory. The name is a link stretched over the row, so
 * the whole row is one target that opens their page. Full (the fuller item):
 * what they are and the badges, with no contact links (B-422). Condensed (the
 * default, B-909): one dense line, the name and specialty, then the main
 * contact action (`quickActions`' first: call, else email, else maps) above
 * the stretched link. Its tags show as chips (two, then "+N"; tags PRD) for
 * every role, in both.
 */
export function ProviderListItem({
  provider,
  practiceName,
  tags,
  condensed = false,
}: {
  provider: LocalProvider;
  practiceName: string | null;
  tags?: readonly { id: string; name: string }[];
  condensed?: boolean;
}) {
  const past = provider.status === "past";
  if (condensed) return <CondensedRow provider={provider} past={past} tags={tags} />;
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
          <Badges provider={provider} past={past} />
        </p>
        <p className="text-muted truncate text-sm">{details.join(" · ")}</p>
        <TagChips tags={tags} className="mt-0.5" />
      </div>
    </ListRow>
  );
}

function CondensedRow({
  provider,
  past,
  tags,
}: {
  provider: LocalProvider;
  past: boolean;
  tags?: readonly { id: string; name: string }[];
}) {
  const main = quickActions(provider)[0];
  return (
    <ListRow
      className="hover:bg-base-200/50 relative isolate flex items-center gap-2"
      data-provider-id={provider.id}
      data-condensed=""
    >
      <p className="flex min-w-0 flex-1 items-baseline gap-1.5">
        <Link
          to={appUrls.provider(provider.groupId, provider.id)}
          className={`min-w-0 shrink truncate font-medium outline-none before:absolute before:inset-0 focus-visible:before:outline-2 focus-visible:before:-outline-offset-2 ${past ? "text-muted" : ""}`}
          data-provider-name
        >
          {provider.name}
        </Link>
        {provider.specialty && (
          <span className="text-muted min-w-0 shrink-[2] truncate text-sm">{provider.specialty}</span>
        )}
      </p>
      <Badges provider={provider} past={past} />
      <TagChips tags={tags} className="shrink-0 flex-nowrap" />
      {main && <ContactActions actions={[main]} />}
    </ListRow>
  );
}

function Badges({ provider, past }: { provider: LocalProvider; past: boolean }) {
  return (
    <>
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
    </>
  );
}
