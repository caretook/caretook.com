import type { FilterMenuProps } from "./FilterMenu";

import { Search } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { FilterMenu, FilterMenuChips } from "./FilterMenu";

/** Navigation state that marks a URL change as the search box's own. */
const FROM_SEARCH_BOX = { listSearchBox: true } as const;
const isFromSearchBox = (state: unknown) =>
  typeof state === "object" && state !== null && "listSearchBox" in state;

export const SEARCH_PLACEHOLDER = "Type to search";

export type SearchFilterBarProps = {
  /** The search box's accessible name ("Search medications"). */
  searchLabel: string;
  /** What the box shows (the caller filters by it as it's typed). */
  value: string;
  /** The URL's `?q=`: a change from elsewhere (a tab, Back) puts it back in the box. */
  urlQuery: string;
  onChange: (value: string) => void;
  /** `search` with `q` as its text (each list keeps its own parameters and order). */
  withQuery: (search: string, q: string) => string;
  /** The Filter menu's data, given the search with the box's live text in it. */
  filters: (search: string) => FilterMenuProps;
  /** Classes for the outer element. */
  className?: string;
};

/**
 * Every list page's search and filter bar (the timeline keeps its own): a
 * search box ("Type to search") filling a row with the Filter button at its
 * end, and the chips of the filters on beneath. What's typed filters the list
 * at once (`onChange`) and is written to `?q=` (replacing the entry, so Back
 * leaves the list), so a reload keeps it. The menu's choices carry the box's
 * live text, so a filter picked right after typing keeps the search.
 */
export function SearchFilterBar({
  searchLabel,
  value,
  urlQuery,
  onChange,
  withQuery,
  filters,
  className = "",
}: SearchFilterBarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const sync = useRef(onChange);
  useEffect(() => {
    sync.current = onChange;
  });
  useEffect(() => {
    if (!isFromSearchBox(location.state)) sync.current(urlQuery);
  }, [location.key, location.state, urlQuery]);

  const menu = filters(withQuery(location.search, value));
  return (
    <div className={`space-y-1.5 ${className}`} data-search-filter-bar="">
      <div className="flex items-center gap-2">
        <form role="search" className="min-w-0 flex-1" onSubmit={(e) => e.preventDefault()}>
          <label className="input w-full">
            <Search className="size-4 opacity-60" aria-hidden="true" />
            <input
              type="search"
              name="q"
              aria-label={searchLabel}
              placeholder={SEARCH_PLACEHOLDER}
              autoComplete="off"
              value={value}
              onChange={(e) => {
                const next = e.currentTarget.value;
                onChange(next);
                void navigate(
                  { search: withQuery(location.search, next) },
                  { replace: true, preventScrollReset: true, state: FROM_SEARCH_BOX },
                );
              }}
            />
          </label>
        </form>
        <FilterMenu {...menu} />
      </div>
      <FilterMenuChips {...menu} />
    </div>
  );
}
