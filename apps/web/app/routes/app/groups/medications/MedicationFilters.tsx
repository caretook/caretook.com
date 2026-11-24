import type { MedicationStatus, MedicationType } from "@caretook/data/schema";
import type { FilterMenuProps } from "~/components/ui";

import { MEDICATION_STATUSES, MEDICATION_TYPES } from "@caretook/data/schema";
import { SearchFilterBar } from "~/components/ui";
import { MEDICATION_TYPE_LABELS, STATUS_LABELS } from "~/lib/medications/medicationDisplay";
import { clearStatus, clearType, setQuery, setStatus, setType } from "~/lib/medications/medicationList";

/**
 * The list's tools: the shared search and filter bar. The menu has Status
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
  return (
    <SearchFilterBar
      searchLabel="Search medications"
      value={value}
      urlQuery={urlQuery}
      onChange={onChange}
      withQuery={setQuery}
      filters={(search) => medicationFilterMenu(search, status, type)}
    />
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
