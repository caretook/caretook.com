import type { MedicationStatus } from "@caretook/data/schema";

import { MEDICATION_STATUSES } from "@caretook/data/schema";
import { Search } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { ChipGroup } from "~/components/ui";
import { STATUS_LABELS } from "~/lib/medications/medicationDisplay";
import { clearStatus, setQuery, setStatus } from "~/lib/medications/medicationList";

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
export function MedicationSearch({
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

/** Status chips: links that set `?status=`, so the filter survives reloads. They change only the status. */
export function StatusFilter({ status }: { status: MedicationStatus | null }) {
  const { search } = useLocation();
  return (
    <ChipGroup
      label="Show medications"
      replace
      preventScrollReset
      links={[
        { id: "all", label: "All", to: { search: clearStatus(search) }, current: !status },
        ...MEDICATION_STATUSES.map((s) => ({
          id: s,
          label: STATUS_LABELS[s],
          to: { search: setStatus(search, s) },
          current: status === s,
        })),
      ]}
    />
  );
}
