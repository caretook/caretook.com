// A group's sections (Timeline and Providers now; Medications and Assistant
// later), from the `GROUP_SECTIONS` registry, rendered twice by the /app frame.

import { Link } from "react-router";
import { GROUP_SECTIONS, isTabBarHidden, sectionCurrent } from "~/lib/groupSections";

/** The header's `sections` region on wide screens: links to the group's sections. */
export function SectionNav({ groupId, pathname }: { groupId: string; pathname: string }) {
  return (
    <nav aria-label="Group sections">
      <ul className="flex items-center gap-1">
        {GROUP_SECTIONS.map((section) => {
          const current = sectionCurrent(section, pathname, groupId);
          const Icon = section.icon;
          return (
            <li key={section.id}>
              <Link
                to={section.path(groupId)}
                aria-current={current}
                className={`btn btn-ghost btn-sm gap-1.5 ${current ? "btn-active" : ""}`}
              >
                <Icon className="size-4" aria-hidden="true" />
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
 * The phone tab bar under the outlet (hidden on the entry page). It's fixed
 * to the bottom, so it also renders a spacer of its height (`--tab-bar-height`)
 * in the page flow: the last thing on any group screen scrolls clear of it,
 * with no screen needing to know the bar exists. It sits under modals
 * (`z-40`; `EntrySheet`'s overlay is `z-50`), so a bottom sheet covers it.
 */
export function TabBar({ groupId, pathname }: { groupId: string; pathname: string }) {
  if (isTabBarHidden(pathname, groupId)) return null;
  return (
    <>
      <div aria-hidden="true" data-tab-bar-spacer className="h-(--tab-bar-height) sm:hidden" />
      <nav aria-label="Group sections" className="dock z-40 h-(--tab-bar-height) sm:hidden">
        {GROUP_SECTIONS.map((section) => {
          const current = sectionCurrent(section, pathname, groupId);
          const Icon = section.icon;
          return (
            <Link
              key={section.id}
              to={section.path(groupId)}
              aria-current={current}
              className={current ? "text-primary" : undefined}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span className="dock-label">{section.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
