import type { TimelineEntryKind, TimelineView, VitalType } from "@caretook/data/schema";
import type { PeriodChoice } from "~/lib/care-periods/periodSearch";

import { VITAL_TYPES, VITALS } from "@caretook/data/schema";
import { CalendarRange, ChevronDown, LayoutList, List, Search, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { ChipGroup, Field, IconButton, Menu, UserAvatar } from "~/components/ui";
import { KIND_META } from "~/lib/timeline/entryDisplay";
import { useGroup } from "~/lib/app-shell/group";
import { duringChipName, duringText } from "~/lib/care-periods/periodSearch";
import { recordSearch } from "~/lib/search/recentSearches";
import {
  clearAuthor,
  clearKind,
  clearPeriod,
  clearQuery,
  clearVital,
  setKind,
  setPeriod,
  setVital,
} from "~/lib/timeline/timelineFilters";
import { useSearchField } from "./useSearchField";

const FILTERS = [
  "note",
  "symptom",
  "event",
  "vital",
  "dose",
  "medicationChange",
] as const satisfies TimelineEntryKind[];

/**
 * The filter row: the search magnifier, then the filter chips, links that
 * set `?kind=`, so the filter survives reloads and Back. They change only the
 * kind (see `lib/timeline/timelineFilters.ts`). With an author filter on (`author`:
 * that person's name and picture), a chip names them and clears it, keeping
 * the kind; with a search on (`q`), a last "Matching “…”" chip clears only
 * the search (and its period). While searching, "Within a period" narrows
 * the matches to one care period's dates (`?period=`), and a "During …"
 * chip clears only the period. The magnifier opens the search field: over the chips on
 * phones, beside them from `sm`. A search used there (Enter, leaving the
 * field) is saved to the recent searches the search page lists. Under the
 * Vitals chip, a second row filters by vital type (`?vital=`): one chip per
 * type the group has readings of (`vitalTypes`).
 */
export function FilterChips({
  kind,
  author,
  q,
  vital = null,
  vitalTypes = [],
  period,
}: {
  kind: TimelineEntryKind | null;
  author: { name: string; image: string | null } | null;
  q: string;
  /** The vital-type filter, under the vital kind. */
  vital?: VitalType | null;
  /** The vital types the group has readings of (any order). */
  vitalTypes?: readonly string[];
  /** The search's care period: the group's choices, and the chosen one. */
  period: { choices: readonly PeriodChoice[]; current: PeriodChoice | null };
}) {
  const { search } = useLocation();
  const navigate = useNavigate();
  const { userId } = useGroup();
  const field = useSearchField(q, (text) => recordSearch(userId, text));
  const fieldId = useId();
  const magnifier = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (field.open) input.current?.focus();
  }, [field.open]);
  const close = () => {
    field.close();
    magnifier.current?.focus();
  };

  return (
    <div className="flex items-start gap-1.5" data-timeline-filters>
      <IconButton
        ref={magnifier}
        label="Search entries"
        icon={Search}
        expanded={field.open}
        controls={field.open ? fieldId : undefined}
        onPress={field.toggle}
        className="border-base-300 bg-base-100 shrink-0 rounded-full"
      />
      {field.open && (
        <div id={fieldId} className="min-w-0 flex-1 sm:w-64 sm:flex-none">
          <Field label="Search entries" labelHidden>
            {(control) => (
              <input
                {...control}
                ref={input}
                type="search"
                autoComplete="off"
                enterKeyHint="search"
                placeholder="Search entries"
                className="input input-sm w-full rounded-full"
                value={field.value}
                onChange={(e) => field.change(e.currentTarget.value)}
                onBlur={field.used}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    field.submit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    close();
                  }
                }}
                data-search-field
              />
            )}
          </Field>
        </div>
      )}
      <div className={field.open ? "hidden min-w-0 flex-1 sm:block" : "min-w-0 flex-1"}>
        <ChipGroup
          label="Show entries"
          replace
          preventScrollReset
          links={[
            { id: "all", label: "All", to: { search: clearKind(search) }, current: !kind },
            ...FILTERS.map((k) => ({
              id: k,
              label: KIND_META[k].plural,
              to: { search: setKind(search, k) },
              current: kind === k,
            })),
            ...(author
              ? [
                  {
                    id: "author",
                    label: `By ${author.name}`,
                    name: `By ${author.name}: clear this filter`,
                    to: { search: clearAuthor(search) },
                    current: true,
                    leading: (
                      <UserAvatar name={author.name} image={author.image} size="xs" className="-ml-1.5" />
                    ),
                    trailing: <X className="size-3.5" aria-hidden="true" />,
                  },
                ]
              : []),
            ...(q && !field.open
              ? [
                  {
                    id: "search",
                    label: `Matching “${chipText(q)}”`,
                    name: `Matching “${q}”: clear the search`,
                    to: { search: clearQuery(search) },
                    current: true,
                    trailing: <X className="size-3.5" aria-hidden="true" />,
                  },
                ]
              : []),
            ...(q && !field.open && period.current
              ? [
                  {
                    id: "period",
                    label: duringText(period.current),
                    name: duringChipName(period.current),
                    to: { search: clearPeriod(search) },
                    current: true,
                    leading: <CalendarRange className="size-3.5" aria-hidden="true" />,
                    trailing: <X className="size-3.5" aria-hidden="true" />,
                  },
                ]
              : []),
          ]}
        />
        {kind === "vital" && <VitalTypeChips search={search} vital={vital} present={vitalTypes} />}
        {q && !field.open && !period.current && period.choices.length > 0 && (
          <Menu
            className="btn btn-ghost btn-sm border-base-300 bg-base-100 mt-1.5 rounded-full px-3"
            menuLabel="Search within a care period"
            placement="bottom start"
            width="lg"
            scrollable
            items={period.choices.map((choice) => ({
              id: choice.id,
              label: choice.name,
              description: choice.dates,
              onAction: () =>
                void navigate(
                  { search: setPeriod(search, choice.id) },
                  { replace: true, preventScrollReset: true },
                ),
            }))}
          >
            <CalendarRange className="size-4" aria-hidden="true" />
            Within a period
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </Menu>
        )}
      </div>
    </div>
  );
}

/** The vital-type row: "All vitals", then each type the group has (and the current one), in the spec's order. */
function VitalTypeChips({
  search,
  vital,
  present,
}: {
  search: string;
  vital: VitalType | null;
  present: readonly string[];
}) {
  const types = VITAL_TYPES.filter((t) => t === vital || present.includes(t));
  if (types.length === 0) return null;
  return (
    <ChipGroup
      label="Show vital types"
      replace
      preventScrollReset
      className="mt-1.5"
      links={[
        { id: "all-vitals", label: "All vitals", to: { search: clearVital(search) }, current: !vital },
        ...types.map((t) => ({
          id: `vital-${t}`,
          label: VITALS[t].label,
          to: { search: setVital(search, t) },
          current: vital === t,
        })),
      ]}
    />
  );
}

/** The search as its chip shows it: long text is cut short (the chip's name has it all). */
const chipText = (q: string) => (q.length > 32 ? `${q.slice(0, 31).trimEnd()}…` : q);

/** The rows/cards switch. */
export function ViewToggle({
  view,
  onChange,
}: {
  view: TimelineView;
  onChange: (view: TimelineView) => void;
}) {
  return (
    <div role="group" aria-label="Layout" className="join shrink-0">
      <IconButton
        label="Rows"
        icon={List}
        pressed={view === "rows"}
        onPress={() => onChange("rows")}
        className="join-item"
      />
      <IconButton
        label="Cards"
        icon={LayoutList}
        pressed={view === "cards"}
        onPress={() => onChange("cards")}
        className="join-item"
      />
    </div>
  );
}
