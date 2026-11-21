import type { ProviderType } from "@caretook/data/schema";
import type { FilterMenuProps } from "~/components/ui";

import { PROVIDER_TYPES } from "@caretook/data/schema";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { FilterMenu, FilterMenuChips } from "~/components/ui";
import { clearType, PROVIDER_TYPE_META, setQuery, setType } from "~/lib/providers/providerDirectory";

/** Navigation state that marks a URL change as the search box's own. */
const FROM_SEARCH_BOX = { providerSearch: true } as const;
const isFromSearchBox = (state: unknown) =>
  typeof state === "object" && state !== null && "providerSearch" in state;

/**
 * The search box. What's typed filters the list at once (`onChange`) and is
 * written to `?q=` (replacing the entry, so Back leaves the directory), so a
 * reload keeps it. A URL change from elsewhere (the Providers tab, a chip
 * after Back) puts its `q` back in the box.
 */
function ProviderSearch({
  value,
  urlQuery,
  onChange,
  className,
}: {
  value: string;
  urlQuery: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const sync = useRef(onChange);
  useEffect(() => {
    sync.current = onChange;
  });
  useEffect(() => {
    if (!isFromSearchBox(location.state)) sync.current(urlQuery);
  }, [location.key, location.state, urlQuery]);

  return (
    <form role="search" className={className} onSubmit={(e) => e.preventDefault()}>
      <label className="input w-full">
        <Search className="size-4 opacity-60" aria-hidden="true" />
        <input
          type="search"
          name="q"
          aria-label="Search providers"
          placeholder="Search by name, specialty or practice"
          autoComplete="off"
          value={value}
          onChange={(e) => {
            const next = e.currentTarget.value;
            onChange(next);
            void navigate(
              { search: setQuery(location.search, next) },
              { replace: true, preventScrollReset: true, state: FROM_SEARCH_BOX },
            );
          }}
        />
      </label>
    </form>
  );
}

/**
 * The directory's tools: the search box filling a row with the Filter button
 * at its end, and the chip of the type on beneath. One section, Type (All, or
 * one type: `?type=`).
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
  // The options and the chip carry the box's live text, not the URL's `?q=` (a navigation behind the
  // typing): a type picked right after typing keeps the search.
  const search = setQuery(useLocation().search, value);
  const filters = useMemo(() => directoryFilterMenu(search, type), [search, type]);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <ProviderSearch value={value} urlQuery={urlQuery} onChange={onChange} className="min-w-0 flex-1" />
        <FilterMenu {...filters} />
      </div>
      <FilterMenuChips {...filters} />
    </div>
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
