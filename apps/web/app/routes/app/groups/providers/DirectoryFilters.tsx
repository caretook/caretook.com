import type { ProviderType } from "@caretook/data/schema";
import type { FilterMenuProps, FilterSection } from "~/components/ui";

import { PROVIDER_TYPES } from "@caretook/data/schema";
import { SearchFilterBar } from "~/components/ui";
import {
  clearFilters,
  clearTag,
  clearType,
  PROVIDER_TYPE_META,
  setQuery,
  setTag,
  setType,
} from "~/lib/providers/providerDirectory";

type Tag = { id: string; name: string };

/**
 * The directory's tools: the shared search and filter bar. Type (All, or one
 * type: `?type=`), then Tag (All tags, or one: `?tag=`) once the group has
 * tags; Clear filters resets both and keeps the search.
 */
export function DirectoryFilterRow({
  value,
  urlQuery,
  onChange,
  type,
  tag,
  tags,
}: {
  value: string;
  urlQuery: string;
  onChange: (value: string) => void;
  type: ProviderType | null;
  /** The tag filtering the list, if the group has it (`activeTag`). */
  tag: string | null;
  /** The group's tags, A to Z: none, no Tag section. */
  tags: readonly Tag[];
}) {
  return (
    <SearchFilterBar
      searchLabel="Search providers"
      value={value}
      urlQuery={urlQuery}
      onChange={onChange}
      withQuery={setQuery}
      filters={(search) => directoryFilterMenu(search, type, tag, tags)}
    />
  );
}

const tagSection = (search: string, tag: string | null, tags: readonly Tag[]): FilterSection[] =>
  tags.length === 0
    ? []
    : [
        {
          id: "tag",
          title: "Tag",
          current: tag ?? "all",
          defaultId: "all",
          options: [
            { id: "all", label: "All tags", search: clearTag(search) },
            ...tags.map((t) => ({ id: t.id, label: t.name, search: setTag(search, t.id) })),
          ],
        },
      ];

const directoryFilterMenu = (
  search: string,
  type: ProviderType | null,
  tag: string | null,
  tags: readonly Tag[],
): FilterMenuProps => ({
  label: "Filter providers",
  clear: clearFilters(search),
  sections: [
    {
      id: "type",
      title: "Type",
      current: type ?? "all",
      defaultId: "all",
      options: [
        { id: "all", label: "All", search: clearType(search) },
        ...PROVIDER_TYPES.map((t) => ({
          id: t,
          label: PROVIDER_TYPE_META[t].plural,
          search: setType(search, t),
        })),
      ],
    },
    ...tagSection(search, tag, tags),
  ],
});
