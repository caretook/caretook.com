import type { NamedTag, ProviderResult } from "./loadSearch";

import { ProviderCard, ProviderRowContact } from "~/components/providers";
import { PROVIDER_TYPE_META } from "~/lib/providers/providerDirectory";
import type { ParsedSearch } from "@caretook/data/domain";
import { notesSnippet } from "@caretook/data/domain";
import { Marked, NotesSnippet } from "./resultParts";

/**
 * A provider as a result: the shared `ProviderCard` (full), its name and its
 * type · specialty · practice line with the matches marked, and a line from
 * its notes when the match is only there. It opens the provider's page
 * (`onOpen`: its read-only sheet, the easy roles).
 */
export function ProviderResultItem({
  provider,
  notes,
  search,
  onOpen,
  tags,
  tagsReadOnly,
}: {
  provider: ProviderResult;
  notes?: string;
  search: ParsedSearch;
  /** Its tags, live (`SearchResults`' one query per kind), the ones the text names first. */
  tags: readonly NamedTag[];
  /** Chips only, whoever's looking (the easy roles, as on the Planner). */
  tagsReadOnly: boolean;
  /** Opens its read-only sheet instead of its page (the easy roles). */
  onOpen?: () => void;
}) {
  const past = provider.status === "past";
  const line = [PROVIDER_TYPE_META[provider.type].label, provider.specialty, provider.practiceName]
    .filter(Boolean)
    .join(" · ");
  const snippet = notesSnippet([provider.name, line], notes, search);
  return (
    <ProviderCard
      provider={provider}
      look="full"
      title={<Marked text={provider.name} search={search} />}
      details={<Marked text={line} search={search} />}
      open={onOpen}
      contact={<ProviderRowContact provider={provider} past={past} />}
      tags={tags}
      tagsReadOnly={tagsReadOnly}
      data-result="provider"
      data-result-id={provider.id}
      data-past={past ? "" : undefined}
    >
      <NotesSnippet snippet={snippet} />
    </ProviderCard>
  );
}
