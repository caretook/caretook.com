import type { ProviderType } from "@caretook/data/schema";

import { PROVIDER_TYPES } from "@caretook/data/schema";
import { Search } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { ChipGroup } from "~/components/ui";
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
export function ProviderSearch({
  value,
  urlQuery,
  onChange,
}: {
  value: string;
  urlQuery: string;
  onChange: (value: string) => void;
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
    <form role="search" onSubmit={(e) => e.preventDefault()}>
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
 * Type filter chips: links that set `?type=`, so the filter survives reloads.
 * They change only the type (see `lib/providers/providerDirectory.ts`).
 */
export function TypeFilter({ type, text }: { type: ProviderType | null; text: string }) {
  // The links carry the box's live text, not the URL's `?q=` (a navigation behind the typing): a tap
  // right after typing keeps the search.
  const search = setQuery(useLocation().search, text);
  return (
    <ChipGroup
      label="Show providers"
      replace
      preventScrollReset
      links={[
        { id: "all", label: "All", to: { search: clearType(search) }, current: !type },
        ...PROVIDER_TYPES.map((t) => ({
          id: t,
          label: PROVIDER_TYPE_META[t].plural,
          to: { search: setType(search, t) },
          current: type === t,
        })),
      ]}
    />
  );
}
