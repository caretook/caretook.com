import type { MedicationStatus, MedicationType } from "@caretook/data/schema";
import type { FilterMenuProps, FilterSection } from "~/components/ui";

import { MEDICATION_STATUSES, MEDICATION_TYPES } from "@caretook/data/schema";
import { SearchFilterBar } from "~/components/ui";
import { MEDICATION_TYPE_LABELS, STATUS_LABELS } from "~/lib/medications/medicationDisplay";
import {
  clearFilters,
  clearStatus,
  clearTag,
  clearType,
  setQuery,
  setStatus,
  setTag,
  setType,
} from "~/lib/medications/medicationList";

type Tag = { id: string; name: string };

/**
 * The list's tools: the shared search and filter bar. The menu has Status
 * (All, or one status: `?status=`), Type (All types, or one: `?type=`) and,
 * once the group has tags, Tag (All tags, or one: `?tag=`); each choice
 * changes only its own parameter, and Clear filters resets them all but
 * keeps the search.
 */
export function MedicationFilterRow({
  value,
  urlQuery,
  onChange,
  status,
  type,
  tag = null,
  tags = [],
}: {
  value: string;
  urlQuery: string;
  onChange: (value: string) => void;
  status: MedicationStatus | null;
  type: MedicationType | null;
  /** The tag filtering the list, if the group has it (`activeTag`). */
  tag?: string | null;
  /** The group's tags, A to Z: none, no Tag section. */
  tags?: readonly Tag[];
}) {
  return (
    <SearchFilterBar
      searchLabel="Search medications"
      value={value}
      urlQuery={urlQuery}
      onChange={onChange}
      withQuery={setQuery}
      filters={(search) => medicationFilterMenu(search, status, type, tag, tags)}
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

/** The Filter menu's data for the list: its sections and where Clear filters goes. */
const medicationFilterMenu = (
  search: string,
  status: MedicationStatus | null,
  type: MedicationType | null,
  tag: string | null,
  tags: readonly Tag[],
): FilterMenuProps => ({
  label: "Filter medications",
  clear: clearFilters(search),
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
    ...tagSection(search, tag, tags),
  ],
});
