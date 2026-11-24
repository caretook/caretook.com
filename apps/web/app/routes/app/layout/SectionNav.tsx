// A group's sections (Timeline and Providers now; Medications and Assistant
// later), from the `GROUP_SECTIONS` registry, rendered twice by the /app frame.

import { Link, useNavigation } from "react-router";
import { ICON, navLinkClass } from "~/components/ui";
import { GROUP_SECTIONS, isTabBarHidden, sectionCurrent } from "~/lib/app-shell/groupSections";
import { useKeyboardOpen } from "~/lib/app-shell/keyboard";

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
 * bar floating clear of the screen's edges, `--tab-bar-bottom` up (just above
 * the home indicator where there's a bottom safe area, `app.css`), on a
 * surface of its own (`--tab-bar-surface`: near-black `neutral` in light,
 * `base-300` in dark), split into one equal full-height section per section
 * of the group, each an icon, the current one filled solid `primary` edge to
 * edge (the bar clips the fills to its rounded shape; the end links round
 * with it so the focus ring, drawn inside the link in the bar's content
 * colour, follows the curve). Each link is named by its section
 * (`aria-label`, and the same `title`). It's fixed, so it also renders a spacer of
 * `--tab-bar-height` (the bar, its gap and its bottom offset) in the page flow:
 * the last thing on any group screen scrolls clear of it, with no screen
 * needing to know the bar exists. It sits under modals (`z-40`; `Sheet`'s
 * overlay is `z-50`), so a bottom sheet covers it. While the on-screen
 * keyboard is open (`useKeyboardOpen`) it slides off the bottom, `inert` and
 * `aria-hidden`, and `data-keyboard-open` is set; it returns when the keyboard
 * closes (the spacer stays, so the page doesn't jump). Tests select it by
 * `data-tab-bar`.
 */
export function TabBar({ groupId, pathname }: { groupId: string; pathname: string }) {
  const target = useTargetPathname(pathname);
  const keyboard = useKeyboardOpen();
  if (isTabBarHidden(pathname, groupId)) return null;
  return (
    <>
      <div aria-hidden="true" data-tab-bar-spacer className="h-(--tab-bar-height) sm:hidden print:hidden" />
      <nav
        aria-label="Group sections"
        data-tab-bar
        data-keyboard-open={keyboard || undefined}
        aria-hidden={keyboard || undefined}
        inert={keyboard}
        className={`fixed inset-x-4 bottom-(--tab-bar-bottom) z-40 mx-auto flex h-14 max-w-xs overflow-hidden rounded-full bg-(--tab-bar-surface) text-(--tab-bar-content) shadow-lg motion-safe:transition-transform motion-safe:duration-(--motion) motion-safe:ease-(--motion-ease) sm:hidden print:hidden ${
          keyboard ? "translate-y-[calc(100%+var(--tab-bar-bottom)+1rem)]" : ""
        }`}
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
              className={`flex min-w-11 flex-1 items-center justify-center first:rounded-s-full last:rounded-e-full focus-visible:-outline-offset-2! focus-visible:outline-(--tab-bar-content)! ${
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
