import type { ProviderType } from "@caretook/data/schema";
import type { FilterMenuProps } from "~/components/ui";

import { PROVIDER_TYPES } from "@caretook/data/schema";
import { SearchFilterBar } from "~/components/ui";
import { clearType, PROVIDER_TYPE_META, setQuery, setType } from "~/lib/providers/providerDirectory";

/**
 * The directory's tools: the shared search and filter bar. One section, Type
 * (All, or one type: `?type=`).
 */
export function DirectoryFilterRow({
  value,
  urlQuery,
  onChange,
  type,
}: {
  value: string;
  urlQuery: string;
  onChange: (value: string) => void;
  type: ProviderType | null;
}) {
  return (
    <SearchFilterBar
      searchLabel="Search providers"
      value={value}
      urlQuery={urlQuery}
      onChange={onChange}
      withQuery={setQuery}
      filters={(search) => directoryFilterMenu(search, type)}
    />
  );
}

const directoryFilterMenu = (search: string, type: ProviderType | null): FilterMenuProps => ({
  label: "Filter providers",
  clear: clearType(search),
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
  ],
});
