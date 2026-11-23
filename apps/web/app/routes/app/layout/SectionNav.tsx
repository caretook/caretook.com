// A group's sections (Timeline and Providers now; Medications and Assistant
// later), from the `GROUP_SECTIONS` registry, rendered twice by the /app frame.

import { Link, useNavigation } from "react-router";
import { ICON, navLinkClass } from "~/components/ui";
import { GROUP_SECTIONS, isTabBarHidden, sectionCurrent } from "~/lib/app-shell/groupSections";

/**
 * The pathname the sections should show as current: the one being navigated
 * to while a navigation is pending (so a tap responds at once, even when the
 * target's loader is slow), else the current one. A cancelled or failed
 * navigation leaves `navigation.location` unset, so it falls back by itself.
 */
function useTargetPathname(pathname: string): string {
  return useNavigation().location?.pathname ?? pathname;
}

/** The header's `sections` region on wide screens: links to the group's sections. */
export function SectionNav({ groupId, pathname }: { groupId: string; pathname: string }) {
  const target = useTargetPathname(pathname);
  return (
    <nav aria-label="Group sections">
      <ul className="flex items-center gap-1">
        {GROUP_SECTIONS.map((section) => {
          const current = sectionCurrent(section, target, groupId);
          const Icon = section.icon;
          return (
            <li key={section.id}>
              <Link
                to={section.path(groupId)}
                prefetch="render"
                aria-current={current}
                className={navLinkClass(!!current)}
              >
                <Icon className={ICON} aria-hidden="true" />
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The phone tab bar under the outlet (hidden on the entry page): a rounded
 * bar floating clear of the screen's edges and the home indicator, on a
 * surface of its own (`--tab-bar-surface`: near-black `neutral` in light,
 * `base-300` in dark), one icon per section, the current one a solid
 * `primary` circle. Each link is named by its section (`aria-label`, and the
 * same `title`). It's fixed, so it also renders a spacer of
 * `--tab-bar-height` (the bar, its gap and the safe area) in the page flow:
 * the last thing on any group screen scrolls clear of it, with no screen
 * needing to know the bar exists. It sits under modals (`z-40`; `Sheet`'s
 * overlay is `z-50`), so a bottom sheet covers it. Tests select it by
 * `data-tab-bar`.
 */
export function TabBar({ groupId, pathname }: { groupId: string; pathname: string }) {
  const target = useTargetPathname(pathname);
  if (isTabBarHidden(pathname, groupId)) return null;
  return (
    <>
      <div aria-hidden="true" data-tab-bar-spacer className="h-(--tab-bar-height) sm:hidden print:hidden" />
      <nav
        aria-label="Group sections"
        data-tab-bar
        className="fixed inset-x-4 bottom-[calc(var(--tab-bar-gap)+env(safe-area-inset-bottom))] z-40 mx-auto flex h-14 max-w-xs items-center justify-around rounded-full bg-(--tab-bar-surface) px-2 text-(--tab-bar-content) shadow-lg sm:hidden print:hidden"
      >
        {GROUP_SECTIONS.map((section) => {
          const current = sectionCurrent(section, target, groupId);
          const Icon = section.icon;
          return (
            <Link
              key={section.id}
              to={section.path(groupId)}
              prefetch="render"
              aria-current={current}
              aria-label={section.label}
              title={section.label}
              className={`flex size-11 items-center justify-center rounded-full ${
                current ? "bg-primary text-primary-content" : "text-(--tab-bar-content)/75"
              }`}
            >
              <Icon className="size-5" aria-hidden="true" />
            </Link>
          );
        })}
      </nav>
    </>
  );
}
