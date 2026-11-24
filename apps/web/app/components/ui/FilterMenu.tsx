import type { FilterExtraChip, FilterSection } from "./filterModel";

import { SlidersHorizontal, X } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { ChipGroup } from "./ChipGroup";
import { filterButtonName, filterChips, filterCount, filterMenuEntries } from "./filterModel";
import { Menu } from "./Menu";
import { CIRCLE, COUNT_BADGE } from "./styles";

/** What both parts take: the same data, so the button and the chips always agree. */
export type FilterMenuProps = {
  /** The menu's accessible name ("Filter medications"). */
  label: string;
  /** One single choice per filter; a section on its default counts for nothing. */
  sections: readonly FilterSection[];
  /** The search with every section on its default (Clear filters goes there). */
  clear: string;
  /** Extra removable chips after the sections' (not counted, not in the menu). */
  chips?: readonly FilterExtraChip[];
  /** Classes for the outer element. */
  className?: string;
};

const NAVIGATION = { replace: true, preventScrollReset: true } as const;
const X_ICON = <X className="size-3.5" aria-hidden="true" />;

/**
 * A list's Filter button: the round tool circle with the sliders icon (a
 * badge counts the filters on; named "Filter" or "Filter, N on"), opening a
 * dropdown with a section per filter (the current choice checked) and, while
 * any is on, "Clear filters". A choice goes to its search at once (replacing
 * the history entry, keeping the scroll) and closes the menu. The caller
 * builds every search string (`?q=` and other parameters are the caller's to
 * keep); the URL is the state. `FilterMenuChips` is its chips row, placed
 * beneath by the screen.
 */
export function FilterMenu({ label, sections, clear, className = "" }: FilterMenuProps) {
  const navigate = useNavigate();
  const count = filterCount(sections);
  const name = filterButtonName(count);
  const items = useMemo(
    () => filterMenuEntries(sections, clear, (search) => void navigate({ search }, NAVIGATION)),
    [sections, clear, navigate],
  );
  return (
    <Menu
      label={name}
      title={name}
      menuLabel={label}
      items={items}
      width="md"
      placement="bottom end"
      variant="ghost"
      size="sm"
      shape="square"
      className={`${CIRCLE} relative ${className}`}
      data-filter-button
    >
      <SlidersHorizontal className="size-4" aria-hidden="true" />
      {count > 0 && (
        <span aria-hidden="true" className={COUNT_BADGE} data-filter-count>
          {count}
        </span>
      )}
    </Menu>
  );
}

/**
 * The filter menu's chips row ("Filters on"): one removable chip per filter
 * off its default (its ✕ clears only that filter), then the extra chips.
 * Nothing on, no row.
 */
export function FilterMenuChips({ sections, chips: extra, className = "" }: FilterMenuProps) {
  const chips = filterChips(sections, extra).map((chip) => ({ ...chip, trailing: X_ICON }));
  if (chips.length === 0) return null;
  return <ChipGroup label="Filters on" replace preventScrollReset links={chips} className={className} />;
}
