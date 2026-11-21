import type { MedicationStatus, MedicationType } from "@caretook/data/schema";
import type { FilterMenuProps } from "~/components/ui";

import { MEDICATION_STATUSES, MEDICATION_TYPES } from "@caretook/data/schema";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { FilterMenu, FilterMenuChips } from "~/components/ui";
import { MEDICATION_TYPE_LABELS, STATUS_LABELS } from "~/lib/medications/medicationDisplay";
import { clearStatus, clearType, setQuery, setStatus, setType } from "~/lib/medications/medicationList";

/** Navigation state that marks a URL change as the search box's own. */
const FROM_SEARCH_BOX = { medicationSearch: true } as const;
const isFromSearchBox = (state: unknown) =>
  typeof state === "object" && state !== null && "medicationSearch" in state;

/**
 * The search box. What's typed filters the list at once (`onChange`) and is
 * written to `?q=` (replacing the entry, so Back leaves the list), so a
 * reload keeps it. A URL change from elsewhere (the Medications tab, a chip
 * after Back) puts its `q` back in the box.
 */
function MedicationSearch({
  value,
  urlQuery,
  onChange,
  className = "",
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
          aria-label="Search medications"
          placeholder="Search by name or reason"
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
 * The list's tools: the search box filling a row with the Filter button at
 * its end, and the chips of the filters on beneath. The menu has Status
 * (All, or one status: `?status=`) and Type (All types, or one: `?type=`);
 * each choice changes only its own parameter, and Clear filters resets both
 * but keeps the search.
 */
export function MedicationFilterRow({
  value,
  urlQuery,
  onChange,
  status,
  type,
}: {
  value: string;
  urlQuery: string;
  onChange: (value: string) => void;
  status: MedicationStatus | null;
  type: MedicationType | null;
}) {
  const { search } = useLocation();
  const filters = useMemo(() => medicationFilterMenu(search, status, type), [search, status, type]);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <MedicationSearch value={value} urlQuery={urlQuery} onChange={onChange} className="min-w-0 flex-1" />
        <FilterMenu {...filters} />
      </div>
      <FilterMenuChips {...filters} />
    </div>
  );
}

/** The Filter menu's data for the list: its two sections and where Clear filters goes. */
const medicationFilterMenu = (
  search: string,
  status: MedicationStatus | null,
  type: MedicationType | null,
): FilterMenuProps => ({
  label: "Filter medications",
  clear: clearType(clearStatus(search)),
  sections: [
    {
      id: "status",
      title: "Status",
      current: status ?? "all",
      defaultId: "all",
      options: [
        { id: "all", label: "All", search: clearStatus(search) },
        ...MEDICATION_STATUSES.map((s) => ({ id: s, label: STATUS_LABELS[s], search: setStatus(search, s) })),
      ],
    },
    {
      id: "type",
      title: "Type",
      current: type ?? "all",
      defaultId: "all",
      options: [
        { id: "all", label: "All types", search: clearType(search) },
        ...MEDICATION_TYPES.map((t) => ({
          id: t,
          label: MEDICATION_TYPE_LABELS[t],
          search: setType(search, t),
        })),
      ],
    },
  ],
});
