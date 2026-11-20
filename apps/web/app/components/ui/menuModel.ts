import type { LucideIcon } from "lucide-react";

/**
 * The menu primitive's data: what callers pass to `Menu`. Pure (no React
 * Aria), so the normalizing rules are unit-tested.
 */

/** One choice in a menu. */
export type MenuItem = {
  id: string;
  label: string;
  /** A second, muted line (e.g. a group's name under its recipient's). */
  description?: string;
  icon?: LucideIcon;
  /** `danger` for destructive choices (Delete). */
  tone?: "danger";
  isDisabled?: boolean;
  /** Called when chosen. Ignored for items in a selection section (use its `onChange`). */
  onAction?: () => void;
  /** A link: an app path, navigated client-side (new tab with a modifier key). */
  href?: string;
  /** History state for a link's navigation (e.g. so a sheet it opens can go back). Ignored without `href`. */
  state?: unknown;
};

/** A group of items, optionally with a heading, a header block, or single selection. */
export type MenuSection = {
  type: "section";
  id: string;
  /** A visible heading (small caps); it also names the section. */
  title?: string;
  /** Names a section that has no visible heading. */
  ariaLabel?: string;
  /** A non-interactive block at the top (e.g. the signed-in user's name and email). Never focused. */
  header?: { title?: string; subtitle?: string };
  items: readonly MenuEntryItem[];
  /**
   * Single selection: the items become `menuitemradio`, the selected one
   * checked. `onChange` gets a newly chosen id (choosing the selected one
   * again doesn't call it).
   */
  selection?: { selected: string; onChange: (id: string) => void };
};

export type MenuSeparator = { type: "separator" };

/** Items may be left out with `false`/`null`/`undefined` (`canEdit && { … }`). */
type Skippable<T> = T | false | null | undefined;
export type MenuEntryItem = Skippable<MenuItem>;
export type MenuEntry = Skippable<MenuItem | MenuSection | MenuSeparator>;

export type NormalizedSection = Omit<MenuSection, "items"> & { items: MenuItem[] };
export type NormalizedEntry =
  ({ type: "item" } & MenuItem) | NormalizedSection | { type: "separator"; id: string };

export const SEPARATOR: MenuSeparator = { type: "separator" };

const isSection = (e: MenuItem | MenuSection | MenuSeparator): e is MenuSection =>
  "type" in e && e.type === "section";
const isSeparator = (e: MenuItem | MenuSection | MenuSeparator): e is MenuSeparator =>
  "type" in e && e.type === "separator";

/**
 * What the menu renders: skipped items dropped, sections with no items
 * (and no header) dropped, and separators only between two shown entries
 * (never first, last or twice in a row). Separators get stable ids.
 */
export function normalizeMenu(entries: readonly MenuEntry[]): NormalizedEntry[] {
  const out: NormalizedEntry[] = [];
  let pendingSeparator = false;
  let separators = 0;
  for (const entry of entries) {
    if (!entry) continue;
    if (isSeparator(entry)) {
      pendingSeparator = out.length > 0;
      continue;
    }
    let next: NormalizedEntry;
    if (isSection(entry)) {
      const items = entry.items.filter((i): i is MenuItem => !!i);
      if (items.length === 0 && !entry.header) continue;
      next = { ...entry, items };
    } else {
      next = { type: "item", ...entry };
    }
    if (pendingSeparator) out.push({ type: "separator", id: `separator-${separators++}` });
    pendingSeparator = false;
    out.push(next);
  }
  return out;
}

/** A section's accessible name: its visible heading, else its `ariaLabel`. */
export const sectionName = (section: Pick<MenuSection, "title" | "ariaLabel">) =>
  section.title ?? section.ariaLabel;

/**
 * The id a selection change chose, or null when it chose nothing new
 * (React Aria passes a Set of keys, or "all").
 */
export function chosenKey(keys: "all" | Iterable<string | number>, selected: string): string | null {
  if (keys === "all") return null;
  const [next] = [...keys];
  return next === undefined || String(next) === selected ? null : String(next);
}

/**
 * The router options a link item navigates with: its history state, if it
 * has one and is a link; otherwise none.
 */
export function linkOptions(item: Pick<MenuItem, "href" | "state">): { state: unknown } | undefined {
  return item.href && item.state !== undefined ? { state: item.state } : undefined;
}
