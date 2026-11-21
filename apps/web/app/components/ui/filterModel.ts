import type { ReactNode } from "react";
import type { LinkChip } from "./chips";
import type { MenuEntry } from "./menuModel";

import { SEPARATOR } from "./menuModel";

/**
 * The filter menu's data: what callers pass to `FilterMenu`, and what it
 * works out from them (the count, the chips, the menu's entries). Pure (no
 * React Aria), so the rules are unit-tested. The URL is the state: every
 * option, chip and Clear filters is a search string the caller built.
 */

/** One choice in a filter: its label, and the search string choosing it leads to. */
export type FilterOption = { id: string; label: string; search: string };

/** One filter: a titled single choice. A section on its default counts for nothing. */
export type FilterSection = {
  id: string;
  /** The section's heading in the menu ("Status"). */
  title: string;
  options: readonly FilterOption[];
  /** The option in effect (an id that isn't an option's reads as the default). */
  current: string;
  /** The option meaning "no filter" ("All"): no count, no chip. */
  defaultId: string;
  /** The chip's text when it should read differently from the current option's label. */
  chipLabel?: string;
};

/** An extra removable chip after the sections' (the Planner's author): not counted. */
export type FilterExtraChip = {
  id: string;
  label: string;
  /** Where its ✕ goes: the search without this filter. */
  search: string;
  /** Its accessible name. Default: "<label>: clear this filter". */
  name?: string;
  /** A decorative node before the label (an avatar). */
  leading?: ReactNode;
};

/** The option in effect, unless it's the default (or not an option). */
const currentOption = (section: FilterSection) =>
  section.options.find((o) => o.id === section.current && o.id !== section.defaultId);

/** The sections off their default, with the option in effect. */
const activeSections = (sections: readonly FilterSection[]) =>
  sections.flatMap((section) => {
    const option = currentOption(section);
    return option ? [{ section, option }] : [];
  });

/** How many filters are on: sections off their default (extra chips don't count). */
export const filterCount = (sections: readonly FilterSection[]) => activeSections(sections).length;

/** The button's name (and title): "Filter", or "Filter, N on". */
export const filterButtonName = (count: number) => (count > 0 ? `Filter, ${count} on` : "Filter");

const clearName = (label: string) => `${label}: clear this filter`;

/**
 * The chips row: one removable chip per section off its default (its ✕
 * goes to that section's default option's search), then the extra chips.
 * The chips carry no trailing ✕: the component adds it.
 */
export function filterChips(
  sections: readonly FilterSection[],
  extra: readonly FilterExtraChip[] = [],
): LinkChip[] {
  const fromSections = activeSections(sections).flatMap(({ section, option }) => {
    const back = section.options.find((o) => o.id === section.defaultId);
    if (!back) return [];
    const label = section.chipLabel ?? option.label;
    return [{ id: section.id, label, name: clearName(label), to: { search: back.search }, current: true }];
  });
  const extras = extra.map((chip) => ({
    id: chip.id,
    label: chip.label,
    name: chip.name ?? clearName(chip.label),
    to: { search: chip.search },
    current: true,
    leading: chip.leading,
  }));
  return [...fromSections, ...extras];
}

/** A menu item's id: the section's and the option's, so options in two sections never clash. */
const itemId = (section: FilterSection, option: FilterOption) => `${section.id}:${option.id}`;

export const CLEAR_FILTERS_ID = "clear-filters";

/**
 * The menu's entries: a titled single-selection section per filter (the
 * current option checked; a choice goes to its search), then, while any
 * filter is on, a separator and "Clear filters" (going to `clear`).
 */
export function filterMenuEntries(
  sections: readonly FilterSection[],
  clear: string,
  go: (search: string) => void,
): MenuEntry[] {
  const entries: MenuEntry[] = sections.map((section) => {
    const selected = currentOption(section) ?? section.options.find((o) => o.id === section.defaultId);
    return {
      type: "section",
      id: section.id,
      title: section.title,
      items: section.options.map((option) => ({ id: itemId(section, option), label: option.label })),
      selection: {
        selected: selected ? itemId(section, selected) : "",
        onChange: (id) => {
          const option = section.options.find((o) => itemId(section, o) === id);
          if (option) go(option.search);
        },
      },
    };
  });
  if (filterCount(sections) === 0) return entries;
  return [...entries, SEPARATOR, { id: CLEAR_FILTERS_ID, label: "Clear filters", onAction: () => go(clear) }];
}
