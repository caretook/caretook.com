import type { LucideIcon } from "lucide-react";

import { CalendarClock, History, Stethoscope } from "lucide-react";
import { appUrls } from "./appUrls";

/**
 * A care group's sections: the destinations of the phone tab bar and the
 * header's section links (`SectionNav`, `TabBar`).
 *
 * **Adding a section** (Medications, Providers, Assistant…) is one entry at
 * the end of `GROUP_SECTIONS` plus its route in `routes.ts`. Keep it a plain
 * ordered list: the order is the order on screen, and later PRDs append
 * (additive registry rule; never reorder).
 */
export type GroupSection = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** The section's own page. */
  path: (groupId: string) => string;
  /**
   * Whether a group-relative path (`/timeline`, `/entries/abc`) belongs to
   * this section. The first matching section is the active one.
   */
  match: (subpath: string) => boolean;
};

/** True when `subpath` is `segment` itself or anything under it. */
const under = (subpath: string, segment: string) => subpath === segment || subpath.startsWith(`${segment}/`);

export const GROUP_SECTIONS: readonly GroupSection[] = [
  {
    id: "timeline",
    label: "Timeline",
    icon: History,
    path: (groupId) => appUrls.timeline(groupId),
    // An entry's page is part of the timeline.
    match: (subpath) => under(subpath, "/timeline") || under(subpath, "/entries"),
  },
  {
    id: "providers",
    label: "Providers",
    icon: Stethoscope,
    path: (groupId) => appUrls.providers(groupId),
    match: (subpath) => under(subpath, "/providers"),
  },
  {
    id: "upcoming",
    label: "Upcoming",
    icon: CalendarClock,
    path: (groupId) => appUrls.upcoming(groupId),
    // The Past tab is part of Upcoming.
    match: (subpath) => under(subpath, "/upcoming"),
  },
];

/**
 * The part of `pathname` inside the group (`/timeline`, `/entries/abc`, or ""
 * for the group itself), or null when `pathname` isn't in that group.
 */
export function groupSubpath(pathname: string, groupId: string): string | null {
  const base = appUrls.groupHome(groupId);
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === base) return "";
  return path.startsWith(`${base}/`) ? path.slice(base.length) : null;
}

/**
 * The section `pathname` is in, and whether it's that section's own page
 * (`aria-current="page"`) or a page inside it (`aria-current="true"`).
 */
export function activeSection(
  pathname: string,
  groupId: string,
  sections: readonly GroupSection[] = GROUP_SECTIONS,
): { section: GroupSection; isPage: boolean } | null {
  const subpath = groupSubpath(pathname, groupId);
  if (subpath === null) return null;
  const section = sections.find((s) => s.match(subpath));
  if (!section) return null;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return { section, isPage: path === section.path(groupId) };
}

/** The `aria-current` value for `section`'s link on `pathname`. */
export function sectionCurrent(
  section: GroupSection,
  pathname: string,
  groupId: string,
  sections: readonly GroupSection[] = GROUP_SECTIONS,
): "page" | "true" | undefined {
  const active = activeSection(pathname, groupId, sections);
  if (active?.section.id !== section.id) return undefined;
  return active.isPage ? "page" : "true";
}

/**
 * Whether the phone tab bar is hidden: outside the group, and on an entry's
 * page (`/entries/:id`, `/entries/new`), so the editor and the keyboard get
 * the whole screen.
 */
export function isTabBarHidden(pathname: string, groupId: string): boolean {
  const subpath = groupSubpath(pathname, groupId);
  return subpath === null || under(subpath, "/entries");
}
