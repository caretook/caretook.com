import type { LucideIcon } from "lucide-react";

// A settings area (the account's and a group's): a short list of
// subpages, shown as the page on phones and as a side nav beside the open
// subpage on wide screens. These are the pure parts, unit-tested in web:unit;
// `SettingsFrame` renders them.

/** One subpage in a settings list, its path already built (through `appUrls`). */
export type SettingsItem = {
  id: string;
  label: string;
  /** One line under the label in the phone list. */
  description: string;
  icon: LucideIcon;
  path: string;
};

/**
 * From this width the list is a side nav and the list's own page opens the
 * first subpage instead. Tailwind's `md`, which `SettingsFrame` uses too.
 */
export const SETTINGS_WIDE_QUERY = "(min-width: 48rem)";

const trimmed = (path: string) => (path.length > 1 ? path.replace(/\/+$/, "") : path);

/** Whether `pathname` is the list itself (`listPath`), not one of its subpages. */
export const isSettingsList = (pathname: string, listPath: string) => trimmed(pathname) === trimmed(listPath);

/**
 * The `aria-current` value for `item`'s link on `pathname`: "page" on the
 * subpage itself, "true" on a page inside it, otherwise undefined.
 */
export function settingsCurrent(item: SettingsItem, pathname: string): "page" | "true" | undefined {
  const path = trimmed(pathname);
  const own = trimmed(item.path);
  if (path === own) return "page";
  return path.startsWith(`${own}/`) ? "true" : undefined;
}
