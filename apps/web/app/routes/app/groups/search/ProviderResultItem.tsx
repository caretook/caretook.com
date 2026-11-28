import type { NamedTag, ProviderResult } from "./loadSearch";

import { ProviderTypeIcon } from "~/components/providers";
import { Badge, STATUS_TONE } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { PROVIDER_TYPE_META } from "~/lib/providers/providerDirectory";
import type { ParsedSearch } from "@caretook/data/domain";
import { notesSnippet } from "@caretook/data/domain";
import { STRETCHED, ROW, OpenName, Marked, NotesSnippet, NamedTags } from "./resultParts";

/**
 * A provider as a result: name, type, specialty and practice; a past
 * provider is marked. Matches are marked, and a match only in its notes
 * shows a line from them. It opens the provider's page (`onOpen`: its sheet).
 */
export function ProviderResultItem({
  provider,
  notes,
  search,
  onOpen,
  namedTags,
}: {
  provider: ProviderResult;
  notes?: string;
  search: ParsedSearch;
  namedTags?: readonly NamedTag[];
  /** Opens its read-only sheet instead of its page (the easy roles). */
  onOpen?: () => void;
}) {
  const past = provider.status === "past";
  const details = [PROVIDER_TYPE_META[provider.type].label, provider.specialty, provider.practiceName].filter(
    Boolean,
  );
  const line = details.join(" · ");
  const snippet = notesSnippet([provider.name, line], notes, search);
  return (
    <li
      className={`${ROW} hover:bg-base-200/50`}
      data-result="provider"
      data-result-id={provider.id}
      data-past={past ? "" : undefined}
    >
      <ProviderTypeIcon type={provider.type} past={past} className="size-8" />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5">
          <OpenName
            to={appUrls.provider(provider.groupId, provider.id)}
            onOpen={onOpen}
            className={`truncate font-medium ${STRETCHED} ${past ? "text-muted" : ""}`}
          >
            <Marked text={provider.name} search={search} />
          </OpenName>
          {past && (
            <Badge tone={STATUS_TONE.past} className="shrink-0" data-marker="">
              Past
            </Badge>
          )}
        </p>
        <p className="text-muted truncate text-sm">
          <Marked text={line} search={search} />
        </p>
        <NotesSnippet snippet={snippet} />
        <NamedTags tags={namedTags} />
      </div>
    </li>
  );
}
