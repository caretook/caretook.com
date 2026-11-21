import type { TimelineEntryKind, VitalType } from "@caretook/data/schema";
import type { LinkChip } from "~/components/ui";
import type { PeriodChoice } from "~/lib/care-periods/periodSearch";

import { VITALS } from "@caretook/data/schema";
import { CalendarRange, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router";
import { ChipGroup, Field, IconButton, UserAvatar } from "~/components/ui";
import { KIND_META } from "~/lib/timeline/entryDisplay";
import { useGroup } from "~/lib/app-shell/group";
import { duringChipName, duringText } from "~/lib/care-periods/periodSearch";
import { recordSearch } from "~/lib/search/recentSearches";
import { clearAuthor, clearKind, clearPeriod, clearQuery, clearVital } from "~/lib/timeline/timelineFilters";
import { FilterSheet } from "./FilterSheet";
import { useSearchField } from "./useSearchField";

const X_ICON = <X className="size-3.5" aria-hidden="true" />;

/**
 * The filter row: the search magnifier, then one Filter button with the
 * count of filters on (kind, vital type, author, period), which opens
 * `FilterSheet`. Under them, each filter on is a removable chip (a link that
 * clears only it, so the URL keeps the rest; see
 * `lib/timeline/timelineFilters.ts`): the kind, the vital type (`?vital=`),
 * "By <name>" (`author`: that person's name and picture), "Matching “…”"
 * (the search, while its field is closed) and "During …" (`?period=`). No
 * filters, no chip row. The magnifier opens the search field beside the
 * button; a search used there (Enter, leaving the field) is saved to the
 * recent searches the search page lists.
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
  const { userId } = useGroup();
  const field = useSearchField(q, (text) => recordSearch(userId, text));
  const fieldId = useId();
  const magnifier = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => {
    if (field.open) input.current?.focus();
  }, [field.open]);
  const close = () => {
    field.close();
    magnifier.current?.focus();
  };

  const during = q ? period.current : null;
  const count = [kind, vital, author, during].filter(Boolean).length;
  const authorChip: LinkChip | null = author && {
    id: "author",
    label: `By ${author.name}`,
    name: `By ${author.name}: clear this filter`,
    to: { search: clearAuthor(search) },
    current: true,
    leading: <UserAvatar name={author.name} image={author.image} size="xs" className="-ml-1.5" />,
    trailing: X_ICON,
  };
  const matchingChip: LinkChip | null = q
    ? {
        id: "search",
        label: `Matching “${chipText(q)}”`,
        name: `Matching “${q}”: clear the search`,
        to: { search: clearQuery(search) },
        current: true,
        trailing: X_ICON,
      }
    : null;
  const active: LinkChip[] = [
    ...(kind ? [removable("kind", KIND_META[kind].plural, clearKind(search))] : []),
    ...(vital ? [removable("vital", VITALS[vital].label, clearVital(search))] : []),
    ...(authorChip ? [authorChip] : []),
    ...(matchingChip && !field.open ? [matchingChip] : []),
    ...(during
      ? [
          {
            id: "period",
            label: duringText(during),
            name: duringChipName(during),
            to: { search: clearPeriod(search) },
            current: true,
            leading: <CalendarRange className="size-3.5" aria-hidden="true" />,
            trailing: X_ICON,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-1.5" data-timeline-filters>
      <div className="flex items-center gap-1.5">
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
        <button
          type="button"
          aria-haspopup="dialog"
          className={`btn btn-sm shrink-0 rounded-full px-3 ${count ? "btn-neutral" : "btn-ghost border-base-300 bg-base-100"}`}
          onClick={() => setSheetOpen(true)}
          data-filter-button
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filter{count > 0 && <span> · {count}</span>}
        </button>
      </div>
      {active.length > 0 && <ChipGroup label="Filters on" replace preventScrollReset links={active} />}
      {sheetOpen && (
        <FilterSheet
          onClose={() => setSheetOpen(false)}
          kind={kind}
          vital={vital}
          vitalTypes={vitalTypes}
          period={q ? period : null}
          extra={[...(authorChip ? [authorChip] : []), ...(matchingChip ? [matchingChip] : [])]}
        />
      )}
    </div>
  );
}

/** A filter's chip: its label and a ✕, named for what it does. */
const removable = (id: string, label: string, search: string): LinkChip => ({
  id,
  label,
  name: `${label}: clear this filter`,
  to: { search },
  current: true,
  trailing: X_ICON,
});

/** The search as its chip shows it: long text is cut short (the chip's name has it all). */
const chipText = (q: string) => (q.length > 32 ? `${q.slice(0, 31).trimEnd()}…` : q);
