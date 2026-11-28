import type { LocalProvider } from "~/lib/providers/providers.sync";

import { ProviderCard } from "./ProviderCard";
import { ProviderRowContact } from "./ProviderRowContact";

/**
 * A provider in the directory (and the setup page's added list): the shared
 * `ProviderCard`. Full (the fuller item, B-940): what they are and the
 * badges, then `ProviderRowContact` (the first number and the address as
 * readable links and an email button). Condensed (the directory's default,
 * B-909): one dense line with the main contact action (`quickActions`'
 * first: call, else email, else maps). Tags as `QuickTags` in both.
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
  if (condensed) return <ProviderCard provider={provider} look="condensed" tags={tags} />;
  return (
    <ProviderCard
      provider={provider}
      look="full"
      practiceName={practiceName}
      tags={tags}
      contact={<ProviderRowContact provider={provider} past={provider.status === "past"} />}
    />
  );
}
