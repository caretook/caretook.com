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

/**
 * The header's `sections` region on wide screens: links to the group's
 * sections. Below `lg` they're icons only (the label stays as screen-reader
 * text and is the hover hint), so from `sm` to `lg` they leave the group menu
 * and the account menu room (B-848).
 */
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
                title={section.label}
                className={navLinkClass(!!current)}
              >
                <Icon className={ICON} aria-hidden="true" />
                <span className="max-lg:sr-only">{section.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The phone tab bar under the outlet (hidden on the entry page): a thin
 * rounded bar (`--tab-bar-bar`, 3rem) floating clear of the screen's edges,
 * `--tab-bar-bottom` up (just above the home indicator where there's a bottom
 * safe area, `app.css`), on a slightly translucent, blurred surface of its own
 * (`--tab-bar-glass`, over `--tab-bar-surface`: light `base-100` in light,
 * `base-300` in dark; solid where `backdrop-filter` isn't supported), split
 * into one equal full-height section per section of the group, each an icon.
 * The current one sits on a `primary` pill (`data-tab-bar-indicator`) with the
 * bar's radius, its slot's full height, that slides to the new section
 * (`transform`, `--motion`; none under reduced motion). The links round like
 * the pill, so the focus ring, drawn inside the link in the bar's content
 * colour, follows it. Each link is named by its section (`aria-label`, and the
 * same `title`). It's fixed, so it also renders a spacer of `--tab-bar-height`
 * (the bar, its gap and its bottom offset) in the page flow: the last thing on
 * any group screen scrolls clear of it, with no screen needing to know the bar
 * exists. It sits under modals (`z-40`; `Sheet`'s overlay is `z-50`), so a
 * bottom sheet covers it. While the on-screen keyboard is open
 * (`useKeyboardOpen`) it slides off the bottom, `inert` and `aria-hidden`, and
 * `data-keyboard-open` is set; it returns when the keyboard closes (the spacer
 * stays, so the page doesn't jump). Tests select it by `data-tab-bar`.
 */
export function TabBar({ groupId, pathname }: { groupId: string; pathname: string }) {
  const target = useTargetPathname(pathname);
  const keyboard = useKeyboardOpen();
  if (isTabBarHidden(pathname, groupId)) return null;
  const currentIndex = GROUP_SECTIONS.findIndex((section) => sectionCurrent(section, target, groupId));
  return (
    <>
      <div aria-hidden="true" data-tab-bar-spacer className="h-(--tab-bar-height) sm:hidden print:hidden" />
      <nav
        aria-label="Group sections"
        data-tab-bar
        data-keyboard-open={keyboard || undefined}
        aria-hidden={keyboard || undefined}
        inert={keyboard}
        className={`fixed inset-x-4 bottom-(--tab-bar-bottom) z-40 mx-auto flex h-(--tab-bar-bar) max-w-xs overflow-hidden rounded-full bg-(--tab-bar-glass) p-0.5 text-(--tab-bar-content) shadow-lg backdrop-blur-md motion-safe:transition-transform motion-safe:duration-(--motion) motion-safe:ease-(--motion-ease) sm:hidden print:hidden ${
          keyboard ? "translate-y-[calc(100%+var(--tab-bar-bottom)+1rem)]" : ""
        }`}
      >
        {currentIndex >= 0 && (
          <span
            aria-hidden="true"
            data-tab-bar-indicator
            className="absolute inset-y-0.5 start-0.5 rounded-full bg-primary motion-safe:transition-transform motion-safe:duration-(--motion) motion-safe:ease-(--motion-ease)"
            style={{
              width: `calc((100% - 0.25rem) / ${GROUP_SECTIONS.length})`,
              transform: `translateX(${currentIndex * 100}%)`,
            }}
          />
        )}
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
              className={`relative flex min-w-11 flex-1 items-center justify-center rounded-full focus-visible:-outline-offset-2! focus-visible:outline-(--tab-bar-content)! ${
                current ? "text-primary-content" : "text-(--tab-bar-content)/75"
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
